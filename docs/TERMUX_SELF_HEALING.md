# Termux self-healing runtime

Grasshopper treats the Android runtime as an unreliable execution boundary. The goal is not to claim that Android can never kill a process. The goal is to make every recoverable failure converge back to the desired state.

## Desired state

- the supervisor is running
- the supervisor holds a Termux wake lock when available
- `runtime/main.py` is running
- `runtime.pid` identifies the live child
- crashes or ordinary process exits are detected and restarted
- duplicate supervisors are refused
- restart events are logged

## Important boundary

A user-space watchdog can restart a child that exits. It cannot guarantee that Android will never terminate the Termux app itself.

For stronger persistence, the deployment must also use Android lifecycle mechanisms such as excluding Termux from battery optimization and, where available, a boot/startup integration. Those are separate capabilities and must be verified on the actual device.

Rish is not used to fake persistence. Rish is a transport into the Android shell. The supervisor runs on the Termux side because that is where the Python runtime and repository live.

## Recovery loop

    desired runtime
        -> supervisor observes
        -> missing/dead child
        -> start child
        -> verify PID/command
        -> continue observing

If the supervisor itself is killed, the state is `NOT_PROVEN` until an Android lifecycle mechanism starts it again.

## Agent rule

Never replace a proven transport because its child process died. First classify the failure as child exit, supervisor exit, Termux app suspension/termination, Android reboot, transport failure, or application failure. Each layer gets its own repair and evidence.
