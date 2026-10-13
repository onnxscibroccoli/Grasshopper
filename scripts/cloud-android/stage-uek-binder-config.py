#!/usr/bin/env python3
"""Prepare a candidate OCI UEK Binder kernel config offline.

Never installs a kernel, modifies the boot config or changes running services.
Input is Oracle's signed UEKR8 SRPM config-aarch64. Output is a new private file.
The resulting config requires vendor-source olddefconfig, build and boot testing.
"""
import argparse
import hashlib
import os
from pathlib import Path
import re
import sys

SYMBOLS = {
    "CONFIG_ANDROID_BINDER_IPC": "y",
    "CONFIG_ANDROID_BINDERFS": "y",
    "CONFIG_ANDROID_BINDER_DEVICES": '"binder,hwbinder,vndbinder"',
}
PROTECTED = ("/boot", "/etc", "/usr", "/lib", "/proc", "/sys", "/dev")


def stage(source: Path, output: Path) -> None:
    source = source.resolve(strict=True)
    output = output.absolute()
    if source == output or output.is_symlink() or output.exists():
        raise ValueError("Output must be a new, different file")
    if not output.parent.is_dir() or output.parent.is_symlink():
        raise ValueError("Output parent must be an existing ordinary directory")
    if any(str(output) == p or str(output).startswith(p + "/") for p in PROTECTED):
        raise ValueError("Refusing to write into protected system directories")
    incoming = source.read_text(encoding="utf-8")
    if len(incoming) < 128 or "CONFIG_" not in incoming:
        raise ValueError("Not a valid kernel config")
    filtered = []
    for line in incoming.splitlines():
        if any(re.fullmatch(r"(?:# )?" + key + r"(?:=.*| is not set)", line) for key in SYMBOLS):
            continue
        filtered.append(line)
    filtered += ["", "# Grasshopper Redroid candidate only; no running kernel change"]
    filtered += [f"{name}={value}" for name, value in SYMBOLS.items()]
    candidate = "\n".join(filtered) + "\n"
    fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(candidate)
    except BaseException:
        output.unlink(missing_ok=True)
        raise
    print("CANDIDATE_CREATED=YES")
    print("BINDER_IPC=y")
    print("BINDERFS=y")
    print("DEVICE_NAMES=binder,hwbinder,vndbinder")
    print("SOURCE_SHA256=" + hashlib.sha256(incoming.encode()).hexdigest())
    print("OUTPUT_SHA256=" + hashlib.sha256(candidate.encode()).hexdigest())
    print("KERNEL_COMPILED=NO")
    print("KERNEL_INSTALLED=NO")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        stage(args.source, args.output)
    except (OSError, ValueError) as exc:
        print("BLOCKED=" + type(exc).__name__, file=sys.stderr)
        sys.exit(2)
