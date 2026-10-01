# Termux self-healing runtime

Grasshopper treats the Android runtime as an unreliable execution boundary. The goal is not to claim that Android can never kill a process. The goal is to make every recoverable failure converge back to the desired state.

## Desired state

- the supervisor is running
- the supervisor holds a Termux wake lock when available
- runtime/main.py is running
- runtime.pid identifies the live child
- crashes or ordinary process exits are detected and restarted
- duplicate supervisors are refused
- restart events are logged

## Important boundary

A user-space watchdog can restart a child that exits. It cannot guarantee that Android will never terminate the Termux app itself.

For stronger persistence, the deployment also uses Android lifecycle mechanisms where available. Termux:Boot can start the supervisor after device boot. Battery-optimization exclusion is a separate Android setting and must be verified on the actual device.

Rish is not used to fake persistence. Rish is a transport into the Android shell. The supervisor runs on the Termux side because that is where the Python runtime and repository live.

## Boot integration

scripts/termux-boot-broccoli-supervisor.sh is a Termux:Boot-compatible launcher. It deliberately fails closed when the installed supervisor or runtime is missing.

On a device with Termux:Boot installed, the launcher can be installed as:

    mkdir -p "$HOME/.termux/boot"
    cp scripts/termux-boot-broccoli-supervisor.sh "$HOME/.termux/boot/broccoli-supervisor"
    chmod +x "$HOME/.termux/boot/broccoli-supervisor"

The boot launcher starts the already-installed supervisor. It does not download mutable code during Android boot.

## Recovery loop

    desired runtime
        -> supervisor observes
        -> missing/dead child
        -> start child
        -> verify PID/command
        -> continue observing

If the supervisor itself is killed, the state is NOT_PROVEN until an Android lifecycle mechanism starts it again. Termux:Boot provides that mechanism for device reboot, but it does not prove that Android will never terminate Termux during normal operation.

## Evidence gates

- direct Termux Rish transport: separate gate
- RDC -> Rish transport: separate gate
- child crash -> supervisor restart: must be explicitly tested
- boot launcher installation: must be explicitly verified
- reboot -> supervisor restart: must be explicitly verified
- Android battery optimization state: must be explicitly verified

## Agent rule

Never replace a proven transport because its child process died. First classify the failure as child exit, supervisor exit, Termux app suspension/termination, Android reboot, transport failure, or application failure. Each layer gets its own repair and evidence.
