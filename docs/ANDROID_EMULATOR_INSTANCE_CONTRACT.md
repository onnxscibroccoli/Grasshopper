# Android emulator instance contract

Date: 2026-10-03

## Purpose

Grasshopper now models two intended Android emulator roles as first-class instance profiles:

- phone-mirror: persistent workspace intended to mirror the physical-phone workflow.
- rooted-dev: persistent development workspace intended for accelerated automation and development.

The control plane owns lifecycle and capability declarations. The emulator runtime owns the actual Android emulator implementation.

## Security boundary

rooted-dev does not imply root merely because the profile name contains rooted. A task must explicitly request desired.rooted=true, and the runtime adapter must separately provide the root capability.

phone-mirror never receives the root capability from the Grasshopper profile.

No APK, account credential, browser cookie, or physical-phone secret is copied by this contract.

## Runtime boundary

The provider requires an injected runtime adapter implementing provision, start, stop, destroy, and inspect.

This keeps the control plane provider-neutral and makes missing emulator infrastructure fail closed.

A runtime adapter is not yet live evidence. The current Grasshopper workstation does not have adb, Cuttlefish, or the Android emulator binary installed, so this commit does not claim that either emulator is running.

## Acceptance gate

For each profile:

1. Provision the named persistent instance.
2. Start it through the runtime adapter.
3. Inspect Android identity and display inventory.
4. Verify the declared capability set.
5. Verify phone-mirror has no root capability.
6. Verify rooted-dev has root only after explicit root enablement and runtime evidence.
7. Stop and restart without changing persistent instance identity.
8. Destroy only ephemeral instances.
9. Record live frame transport separately. Control-plane readiness must never be treated as frame-stream readiness.
