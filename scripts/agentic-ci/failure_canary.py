#!/usr/bin/env python3
"""Non-production transient-failure canary for CI diagnostics only."""
from pathlib import Path

def main():
    p = Path("artifacts")
    p.mkdir(exist_ok=True)
    marker = p / "ollama-transient-canary.marker"
    output = p / "ollama-transient-canary.ok"
    if not marker.exists():
        marker.write_text("first failure was observed")
        print("EAI_AGAIN: simulated transient dependency interruption")
        return 42
    output.write_text("postcondition PASS after exact rerun")
    print("CANARY_RECOVERY=VERIFIED")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
