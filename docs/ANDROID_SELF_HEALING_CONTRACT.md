# Android self-healing contract

Grasshopper treats the Android executor as a recoverable edge, not as an
immortal process.

The Broccoli runtime uses a singleton supervisor with:

- atomic lock acquisition
- supervisor identity validation
- independent child PID tracking
- live runtime command validation
- adoption of an existing healthy runtime
- restart after controlled runtime death
- Termux:Boot restoration after device reboot
- optional wake lock

Grasshopper's gate must distinguish:

1. supervisor exists
2. exactly one supervisor exists
3. exactly one valid runtime exists
4. runtime survives ordinary background operation
5. controlled runtime death is recovered
6. device reboot restores the supervisor
7. Android battery/background policy has been configured by the user

No shell-only mechanism can guarantee that Android will never terminate an
application. Force-stop, resource pressure, crashes, thermal policy, OEM
background policy, and user actions remain outside the process supervisor's
control.

The correct production claim is therefore:

AUTO_RESTORE + WAKE_LOCK + USER_CONFIGURED_BATTERY_POLICY

not an absolute guarantee against Android termination.

## Development rule

A supervisor failure is an implementation bug to diagnose from evidence.
A platform termination is an environmental boundary to recover from.

Do not multiply workers to hide a failed health check. First establish whether
the existing process is alive and whether its command identity matches the
desired runtime. Only then start a replacement.
