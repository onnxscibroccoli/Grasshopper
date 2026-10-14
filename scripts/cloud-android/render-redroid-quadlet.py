#!/usr/bin/env python3
"""Stage a digest-locked Podman Quadlet without any root-side mutations.

NEVER installs, enables, starts or restarts production services. A trusted
operator can later review the generated file and install it through sudo.
"""
import argparse
from pathlib import Path
import re
import sys

DIGEST=re.compile(r"^[a-f0-9]{64}$")
TEMPLATE="__REQUIRED_IMAGE_DIGEST__"

def render_quadlet(source: str, digest: str) -> str:
    if not DIGEST.fullmatch(digest):
        raise ValueError("OCI production image requires a full SHA-256 digest")
    if source.count(TEMPLATE)!=1:
        raise ValueError("Missing or duplicated image digest placeholder")
    text=source.replace(TEMPLATE,digest)
    required=(
        "PublishPort=127.0.0.1:5556:5555",
        "RequiresMountsFor=/srv/grasshopper/redroid-data",
        "Volume=/srv/grasshopper/redroid-data:/data:Z",
        "ConditionPathExists=/dev/binder",
        "ConditionPathExists=/dev/hwbinder",
        "ConditionPathExists=/dev/vndbinder",
        "Restart=always",
        "WantedBy=multi-user.target",
    )
    if any(s not in text for s in required):
        raise ValueError("Missing essential persistence or privacy gates")
    if re.search(r"(?m)^PublishPort=(?!127\.0\.0\.1:)",text):
        raise ValueError("Refusing public ADB mapping")
    return text

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--digest",required=True)
    parser.add_argument("--out-dir",required=True)
    args=parser.parse_args()
    target=Path(args.out_dir)
    if not target.is_dir() or target.is_symlink():
        raise ValueError("Existing staging directory required")
    output=target/"grasshopper-redroid.container"
    if output.exists() or output.is_symlink():
        raise ValueError("No file overwrite permitted")
    source=(Path(__file__).parent.parent.parent/"deploy/quadlet/grasshopper-redroid.container.in")
    text=render_quadlet(source.read_text(encoding="utf8"),args.digest)
    output.write_text(text,encoding="utf8")
    output.chmod(0o600)
    print("REDROID_QUADLET_STAGED=YES")
    print("REDROID_QUADLET_INSTALL=NOT_PERFORMED")
    print("REBOOT=NOT_PERFORMED")
    print("OCI_HOST_SERVICES_RESTARTED=NO")

if __name__=="__main__":
    try:main()
    except (ValueError,OSError) as e:
        print("REDROID_QUADLET=BLOCKED_"+type(e).__name__,file=sys.stderr)
        sys.exit(2)
