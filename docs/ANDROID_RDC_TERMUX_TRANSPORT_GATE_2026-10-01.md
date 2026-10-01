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

## Corrected proof contract

Empty stdout is not a verdict. `rish` starts `app_process`, which does not reliably inherit the RDC pipe. uid 2000 cannot write Termux home, so the artifact must be written by the Rish command to shared storage.

Canonical probe in `broccoli-core` (calls `lib/rish_run.sh`, does not edit it):

```
/data/data/com.termux/files/usr/bin/bash -lc 'bash $HOME/broccoli-core/tools/rdc_termux_anchor.sh'
```

Accept only if this file exists and contains the three markers:

```
/storage/emulated/0/Download/RDC_TERMUX_ANCHOR.txt
```

```
RDC_TERMUX_ANCHOR_OK
uid=2000(shell)
sdk=35
```

Fallback copy: `/data/local/tmp/RDC_TERMUX_ANCHOR.txt`.

If RDC is shell uid rather than the Termux app uid, do not treat `am` RC=0 as execution. The supported external hop, after `allow-external-apps=true` and a Termux force-stop, is an explicit foreground service whose only proof is the same file:

```
am start-foreground-service --user 0 \
  -n com.termux/com.termux.app.RunCommandService \
  -a com.termux.RUN_COMMAND \
  --es com.termux.RUN_COMMAND_PATH /data/data/com.termux/files/usr/bin/bash \
  --esa com.termux.RUN_COMMAND_ARGUMENTS -l,-c,bash\ $HOME/broccoli-core/tools/rdc_termux_anchor.sh \
  --es com.termux.RUN_COMMAND_WORKDIR /data/data/com.termux/files/home \
  --ez com.termux.RUN_COMMAND_BACKGROUND true
```

## Off-device limitation

OmniKali has no adb client and no attached device. `npx @wonderwhy-er/desktop-commander@latest remote` authenticates a host to mcp.desktopcommander.app; it does not cross this Android gate. It was not started.

## Required next acceptance artifact

```
RDC_TERMUX_ANCHOR_OK
uid=2000(shell)
sdk=35
```

The artifact must be persistent and independently inspectable. This document does not claim that artifact exists.

## Intended execution chain

```
RDC
  ↓
login Termux bash
  ↓
tools/rdc_termux_anchor.sh
  ↓
lib/rish_run.sh
  ↓
Rish/Shizuku
  ↓
shared-storage artifact
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
