# Stage 0 clean Cloud Android

`stage0-clean-device.sh` is the non-destructive admission and evidence gate for the first bidirectional-control doorway.

It records environment identity, source and legacy benchmark lineage, CPU/RAM/swap, KVM/QEMU availability, existing QEMU footprint, and ADB transport signals.

It never starts or stops QEMU. A failed admission exits 75 and leaves existing Cloud Android and Kali sessions untouched.

Stage 0 is not complete until a subsequent disposable boot proves Android identity after admission passes.
