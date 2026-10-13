#!/usr/bin/env python3
"""Install a pinned, non-root RDC boot service only after operator sudo approval.

Do not restart current RDC/VNC/noVNC/Kali services or initiate a reboot.
"""
import argparse
import os
from pathlib import Path
import pwd
import re
import subprocess
import sys
import tempfile

UNIT = "grasshopper-rdc.service"
PROTECTED = ("grasshopper-vnc.service", "grasshopper-novnc.service", "grasshopper-mcp.service")
DEST = Path("/etc/systemd/system") / UNIT
POLICY = Path("/etc/sudoers.d/grasshopper-rdc-recovery")
ENTRY_RE = re.compile(r"^/home/grasshopper/\.npm/_npx/[a-z0-9]+/node_modules/@wonderwhy-er/desktop-commander/dist/index\.js$")


def state(unit, command):
    p = subprocess.run(["systemctl", command, unit], text=True,
                       capture_output=True, timeout=8)
    return p.returncode == 0 and p.stdout.strip() == (
        "enabled" if command == "is-enabled" else "active"
    )


def unit_text(entry, delegated=False):
    # The remote service itself is never root. Limited sudo delegation is
    # optional, local, and requires an explicit interactive sudo invocation.
    return f"""[Unit]
Description=Grasshopper Remote Desktop Commander persistent agent
Wants=network-online.target
After=network-online.target grasshopper-vnc.service grasshopper-novnc.service grasshopper-mcp.service
StartLimitIntervalSec=0

[Service]
Type=simple
User=grasshopper
Group=grasshopper
WorkingDirectory=/home/grasshopper
Environment=HOME=/home/grasshopper
Environment=PATH=/usr/local/bin:/usr/bin:/bin
ExecStart=/usr/bin/env node {entry} remote
Restart=always
RestartSec=15
TimeoutStopSec=25
NoNewPrivileges={str(not delegated).lower()}
UMask=0077
ProtectSystem=full
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true

[Install]
WantedBy=multi-user.target
"""


def sudoers():
    return ("grasshopper ALL=(root) NOPASSWD: "
            "/usr/bin/systemctl restart grasshopper-rdc.service, "
            "/usr/bin/systemctl status grasshopper-rdc.service, "
            "/usr/bin/systemctl is-active grasshopper-rdc.service\n")


def write_new(path, content, mode):
    if path.exists() or path.is_symlink():
        raise ValueError("Refusing overwrite of existing configuration")
    temporary = path.with_name("." + path.name + ".candidate")
    fd = os.open(temporary, os.O_CREAT | os.O_WRONLY | os.O_EXCL | os.O_NOFOLLOW, mode)
    try:
        with os.fdopen(fd, "w") as stream:
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("audit", "stage", "install"))
    parser.add_argument("--entry", type=Path)
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--allow-recovery-sudo", action="store_true")
    args = parser.parse_args()

    if args.action == "audit":
        for name in (*PROTECTED, UNIT):
            print(f"{name}: enabled={state(name, 'is-enabled')} active={state(name, 'is-active')}")
        return

    if args.entry is None:
        raise ValueError("Explicit pinned, local RDC entrypoint required")
    entry = args.entry.resolve(strict=True)
    if not entry.is_file() or any(c.isspace() for c in str(entry)):
        raise ValueError("Unsafe RDC entrypoint")

    if args.action == "stage":
        if args.allow_recovery_sudo:
            raise ValueError("Privileged delegation cannot be staged without host policy verification")
        if not args.output_dir or not args.output_dir.is_dir():
            raise ValueError("Existing output directory required")
        target = args.output_dir / UNIT
        if target.exists() or target.is_symlink():
            raise ValueError("Refusing to overwrite staged unit")
        target.write_text(unit_text(entry), encoding="utf-8")
        print("CANDIDATE_UNIT_STAGED=YES")
        return

    if os.geteuid() != 0:
        raise PermissionError("Human must explicitly authorize with sudo")
    if not ENTRY_RE.fullmatch(str(entry)) or not Path("/usr/bin/node").is_file():
        raise ValueError("Production pinned binary path or Node unavailable")
    if pwd.getpwnam("grasshopper").pw_uid == 0:
        raise ValueError("Remote agent service account must not be root")
    if not all(state(name, "is-enabled") and state(name, "is-active")
               for name in PROTECTED):
        raise RuntimeError("Protected VNC/noVNC/MCP unit unavailable; abort")
    if DEST.exists() or DEST.is_symlink():
        raise ValueError("Existing RDC unit: refuse to overwrite")
    if args.allow_recovery_sudo:
        if POLICY.exists() or POLICY.is_symlink():
            raise ValueError("Existing sudoers policy: refuse overwrite")
        with tempfile.NamedTemporaryFile(mode="w", prefix="rdc-sudoers-", delete=True) as f:
            f.write(sudoers())
            f.flush()
            subprocess.run(["/usr/sbin/visudo", "-cf", f.name],
                           check=True, stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL, timeout=10)
    write_new(DEST, unit_text(entry, args.allow_recovery_sudo), 0o644)
    subprocess.run(["systemctl", "daemon-reload"], check=True, timeout=15)
    subprocess.run(["systemctl", "enable", UNIT], check=True, timeout=15)
    if args.allow_recovery_sudo:
        write_new(POLICY, sudoers(), 0o440)
    print("RDC_ENABLED_FOR_NEXT_BOOT=YES")
    print("RUNNING_REMOTE_DESKTOPS_RESTARTED=NO")
    print("REBOOT_TRIGGERED=NO")
    print("KALI_RESTART_PERSISTENCE=NOT_PROVEN")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as exc:
        print("BOOT_SETUP_BLOCKED=" + type(exc).__name__, file=sys.stderr)
        sys.exit(2)
