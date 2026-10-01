# Android System Package Audit 2026-10-01

## Evidence identity

- Android device: Samsung SM-A146U
- Android: 15
- API: 35
- RDC device: `localhost`
- RDC device ID: `566d623e-df45-4b16-b2be-4cbd08567a49`
- Audit output: `/sdcard/OmniKali/android-package-audit-20261001-130941`
- Audit method: Android `pm` inventory through the live device, with path classification
- Canonical Rish contract: unchanged

## Inventory

The live device currently reports:

- 91 third-party packages
- 220 packages whose APK path is under `/system`
- 12 under `/system_ext`
- 47 under `/product`
- 16 under `/vendor`
- 26 under `/apex`
- 76 under `/data/app`
- 63 under `/mnt/asec`

The `data_app` and `mnt_asec` locations are important. Package classification by the Android `system` flag alone is not equivalent to "stock immutable system APK".

## System-flagged packages outside base partitions

48 packages currently carry the system-package classification while their installed APK path is under `/data/app`. Examples include Chrome, Play Store, Google Play services, WebView, Samsung services, and carrier components.

This is evidence of updated/system-designated packages, not evidence that all 48 are aftermarket. A future audit should compare installer/source, signing certificate, version, and known firmware package manifests before assigning provenance.

No system-flagged package was observed under `/mnt/asec` in this audit.

## Morphe and execution-plane packages

Installed and observed:

- `app.morphe.manager`
- `app.morphe.android.youtube`
- `app.morphe.android.apps.youtube.music`
- `com.termux`
- `com.termux.api`
- `com.termux.boot`
- `com.termux.gui`
- `com.termux.window`
- `com.gardockt.termuxterminalwidget`
- `io.github.swiftstagrime.termuxrunner`
- `moe.shizuku.privileged.api`

The official Termux Float, Styling, Tasker, Widget, and X11 package IDs were not present in the package inventory at audit time. This is not a design exclusion. They remain candidates for the human interaction plane.

## Important architectural finding

Morphe already separates patch execution from the Android UI in its patcher library. The remote/off-device architecture should therefore treat APK patching as a portable worker capability rather than making APKTool a required phone-side dependency.

The preferred future pipeline is:

1. acquire original APK
2. preserve immutable original and cryptographic hash
3. inspect APK
4. resolve compatible Morphe patch source/version
5. run patch/build in a persistent remote worker
6. sign output with an explicit artifact identity
7. verify package/version/signature/artifact hash
8. transfer APK to Android
9. optionally install through an explicit human gate or Shizuku-controlled installer
10. retain provenance, logs, source versions, and output hash

The worker should support both Morphe Patcher-native patch execution and APKTool where resource decoding/rebuilding is actually required. Do not force APKTool into bytecode/raw-resource patches when the Morphe patcher can avoid that cost.

## Evidence labels

- Android package inventory: **PASS**
- System-vs-third-party inventory: **PASS**
- System provenance determination for every package: **NOT_PROVEN**
- Termux Float/X11/Styling exclusion: **NOT_APPLICABLE**. They are not installed, but remain eligible future components.
- Remote APK patch worker: **DESIGN_ONLY**
- Reproducible Morphe patch artifact pipeline: **NOT_PROVEN**
