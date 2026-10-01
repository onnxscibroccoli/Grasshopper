# Termux self-healing live evidence

Date: 2026-10-01
Device: Android / Termux via Remote Desktop Commander
Repository branch: feat/termux-lifecycle-self-healing

## Gates

| Gate | Status | Evidence |
|---|---|---|
| RDC Android endpoint | PASS | RDC ping succeeded; platform reported Android; Termux bash and Python 3.14.6 available |
| Direct Rish through RDC child | NOT_PROVEN | rish exits 0 from an RDC child but emits no stdout; direct Termux Rish remains a separate proven gate |
| Supervisor syntax | PASS | bash -n passed on device |
| Runtime startup under supervisor | PASS | runtime reached Runtime READY and State: INITIALIZING -> RUNNING |
| Child crash recovery | PASS | child PID 16264 was terminated; supervisor replaced it with PID 19541; replacement reached Runtime READY and RUNNING |
| Supervisor PID ownership | PASS | live PID file contained 18809, matching the running supervisor |
| Duplicate supervisor protection | PASS | Termux:Boot launcher returned RC 0; PID remained 18809 and supervisor remained alive |
| Termux:Boot launcher installed | PASS | $HOME/.termux/boot/broccoli-supervisor installed, chmod +x, bash -n passed |
| Reboot survival | NOT_PROVEN | no Android reboot was performed during this gate |
| Android battery optimization exemption | NOT_PROVEN | no exemption was claimed without direct Android evidence |
| Android never kills Termux | NOT_PROVEN | user-space watchdog cannot prove this |

## Defects found and fixed

1. Launching runtime/main.py by absolute path omitted the repository root from Python imports. The supervisor now supplies PYTHONPATH.
2. A duplicate supervisor could previously run cleanup and remove the live supervisor PID file. Cleanup is now ownership-aware.
3. Supervisor PID ownership previously depended on a fragile shell token. The implementation now uses Bash BASHPID.

## Current desired state

- one supervisor process
- one live runtime child
- wake lock requested where Termux provides it
- duplicate supervisor launches refused without deleting the live PID file
- child exits converge back to a running runtime

This evidence does not claim Android lifecycle persistence beyond the gates explicitly marked PASS.

## Follow-up transport and Android security evidence

A follow-up RDC audit found:

- RDC process identity is the Termux application UID, not Android shell.
- Rish executable exists and its Shizuku DEX exists.
- Shizuku package is installed, but no active Shizuku process was observable from the Termux UID.
- RDC -> Rish returned rc=0 with zero stdout/stderr for echo, id, stderr, and exit-7 probes.
- A target-side artifact probe also produced no artifact. RDC -> Rish therefore remains NOT_PROVEN.
- Direct /system/bin/cmd deviceidle whitelist +com.termux was rejected with android.permission.DEVICE_POWER. No battery exemption was granted.
- com.termux.boot is not installed on the device. The boot launcher script exists in ~/.termux/boot, but reboot execution is therefore NOT_PROVEN.

These are boundary findings, not failures of the Broccoli supervisor. The correct next dependency is an active supported Shizuku service plus Termux:Boot installation and explicit Android battery-policy evidence.
