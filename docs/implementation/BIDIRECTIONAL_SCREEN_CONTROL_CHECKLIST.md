# Bidirectional Screen Control: Iterative Implementation Checklist

This checklist is a resumable execution contract. **Every completed stage is a doorway to further development, never a terminal state.** Agents MUST resume at the first unlocked incomplete stage.

## Rules
- [ ] Never mark a stage complete from process liveness alone.
- [ ] Every completion requires executable evidence.
- [ ] Preserve the known-good artifact before modifying it.
- [ ] A failure loops inside the current stage until its doorway condition is proven.
- [ ] Completion unlocks the next stage automatically.
- [ ] Resume from persisted state after interruption.
- [ ] Do not replace proven legacy behavior without an equivalent regression test.
- [ ] Do not destroy a working Android session merely to test reconnection.
- [ ] Human recovery/control remains available throughout.
- [ ] Record delivery, visible acknowledgement, semantic effect and reconnect continuity as separate `grasshopper.android-control-evidence/v1` gates.
- [ ] Never promote `TEST_FIXTURE` evidence to live acceptance or R2.
- [ ] Treat an observed RFB operation as provenance, never as permission or proof that this adapter dispatched it.
- [ ] A changed framebuffer proves only visible acknowledgement; require separate evidence for delivery, semantics and reconnect continuity.
- [ ] Browser reconnect continuity requires an independently recorded, digest-bound same-session observation with advancing sequence, client-only disconnect and no guest restart.
- [ ] A reconnect observation never proves input delivery, visible acknowledgement or semantic effect.
- [ ] Physical-Android evidence names the canonical `onnxscibroccoli/broccoli-core:lib/rish_run.sh` commit and blob and records `RISH_PRESERVE_ENV=0`.
- [ ] Never copy, patch or embed the canonical Rish wrapper in Grasshopper; consume digest-bound observation records only.
- [ ] Wrapper qualification alone never proves cloud-Android delivery, visible acknowledgement, semantics, reconnect continuity or R2.

## Stage 0: Clean Cloud Android
- [ ] Detect active environment.
- [ ] Record SHA, environment contract, CPU/RAM, KVM/QEMU and transport availability.
- [ ] Preserve the known-good Cloud Android benchmark.
- [ ] Create disposable clean state.
- [ ] Boot exactly one resource-admitted Cloud Android instance.
- [ ] Prove Android device identity.
- [ ] Save boot/resource evidence.

**Doorway:** clean device + identity + resource admission proven.

## Stage 1: Screen acquisition
- [ ] Acquire a real Cloud Android frame/delta.
- [ ] Attach session ID and monotonic sequence.
- [ ] Prove acquisition survives observer reconnect.
- [ ] Save screen evidence.

**Doorway:** real screen data is available through screen-control-v1.

## Stage 2: Workstation input acknowledgement
- [ ] Send workstation touch/key/text input.
- [ ] Deliver through the shared contract.
- [ ] Receive acknowledgement tied to input sequence.
- [ ] Verify expected Android UI change.
- [ ] Save before/after screen and acknowledgement evidence.

**Doorway:** Grasshopper can observe AND control Cloud Android.

## Stage 3: Physical Android RDC input acknowledgement
- [ ] Detect physical Android automatically.
- [ ] Establish RDC/Termux/Rish/Shizuku path.
- [ ] Observe the same Cloud Android session.
- [ ] Send input from physical Android.
- [ ] Receive sequence-linked acknowledgement.
- [ ] Verify Cloud Android UI change.
- [ ] Save transport/ack evidence.

**Doorway:** physical Android independently controls Cloud Android through the same contract.

## Stage 4: Reconnect
- [ ] Disconnect observer/control client without terminating Cloud Android.
- [ ] Reconnect workstation.
- [ ] Reconnect physical Android path.
- [ ] Recover session/device state.
- [ ] Continue sequence/acknowledgement correctly.
- [ ] Prove Android session survived client disconnect.

**Doorway:** reconnect no longer destroys the device session.

## Stage 5: Persistent session
- [ ] Restart an observer.
- [ ] Preserve Cloud Android VM/session.
- [ ] Restore screen acquisition.
- [ ] Restore workstation input.
- [ ] Restore physical Android input.
- [ ] Verify state continuity.

**Doorway:** Cloud Android is a persistent controllable device, not a disposable viewer.

## Stage 6: Simultaneous control arbitration
- [ ] Use one shared session ID.
- [ ] Accept workstation and physical Android actions concurrently.
- [ ] Enforce deterministic ordering.
- [ ] Prevent duplicate/replayed input.
- [ ] Resolve competing human/agent actions deterministically.
- [ ] Preserve human override/recovery.
- [ ] Verify acknowledgements from both surfaces.
- [ ] Run sustained bidirectional control without session loss.

**Doorway:** bidirectional screen control is operationally proven.

## Stage 7: Continuous-development doorway
- [ ] Record complete evidence bundle.
  - Repository format and fail-closed index verification exist; live three-origin evidence is still missing.
- [ ] Promote proven implementation.
- [ ] Re-run legacy benchmark comparison.
- [ ] Extract reusable core logic from deployment adapters.
- [ ] Add regression tests for every discovered failure.
- [ ] Generate the next implementation checklist from the newly exposed boundary.

**Continuous rule:** Stage 7 creates the next doorway. There is deliberately no permanent "done" state.
