# RDC -> Termux -> Broccoli Transport Gate

**Recorded:** 2026-10-01 UTC  
**Gate:** Android agent execution transport  
**Current state:** NOT_PROVEN

## Why this gate exists

The Android execution stack has independently established evidence for:

1. Android API 35.
2. Interactive Shizuku/Rish execution.
3. Broccoli invoking Rish.
4. Rish reaching a privileged shell with `uid=2000(shell)`.

The remaining question is whether a Remote Desktop Commander-created process can safely hand execution into that already-proven Termux/Broccoli environment.

## Do not repair the wrong boundary

The historical Broccoli/Rish implementation is treated as a known-good execution component.

Do not change:

- `rish_run.sh`
- `rish_cmd.sh`
- the legacy Broccoli implementation

just because an RDC-created child currently returns RC=0 without an observable payload.

## Current evidence

RDC can create a Termux-shell child and access the Broccoli source tree. From that child:

- direct `rish` invocation returned RC=0 but no expected observable result;
- `com.termux.RUN_COMMAND` broadcast returned RC=0 but did not create the expected persistent artifact;
- explicit Termux RunCommandService invocation likewise did not create the artifact.

Therefore the transport handoff remains **NOT_PROVEN**, not failed permanently.

## Required next acceptance artifact

```
RDC_TERMUX_ANCHOR_OK
uid=2000(shell)
sdk=35
```

The artifact must be persistent and independently inspectable.

## Intended execution chain

```
RDC
  ↓
supported Termux external-command mechanism
  ↓
working Broccoli
  ↓
Rish/Shizuku
  ↓
Ruto
  ↓
virtual display
  ↓
Grok
  ↓
screenshot
  ↓
visual verification
```

Ruto and Grok-on-secondary-display remain explicitly **NOT_STARTED** until the transport gate passes.

## Agent rule

Future agents should preserve the proven components, reproduce the narrow transport failure, record evidence, and change only the failing boundary.
