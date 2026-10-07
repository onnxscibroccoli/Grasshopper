# Cloud Android bidirectional control contract

The target architecture has two independent control paths over one device session:

- Grasshopper workstation -> Cloud Android: screen observation, touch/key/text input, lifecycle, and ADB actions.
- Physical Android -> Cloud Android: the same screen observation and action contract through RDC, Termux, Rish/Shizuku, and the Broccoli adapter.

Both paths terminate at the same device-session contract. They must not fork into separate implementations of Android input semantics.

## Required capabilities

1. Active environment detection chooses the local adapter without operator edits.
2. Screen frames or deltas carry a monotonically increasing sequence.
3. Input carries an acknowledgement tied to the input sequence.
4. Device state reports boot, transport, and control readiness separately.
5. Human GUI input has precedence over agent input on shared sessions.
6. A disconnected observer may reconnect without destroying the Android session.
7. The physical Android path can act as an independent agent host and can also control the same Cloud Android target.
8. Cloud Android can report its state back to Grasshopper and to the physical Android control plane.

The protocol is defined by schemas/screen-control-v1.json. Transport implementations remain replaceable.
