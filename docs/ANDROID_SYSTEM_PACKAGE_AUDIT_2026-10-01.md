# Android System Package Audit - 2026-10-01

## Evidence identity

- Device: Samsung SM-A146U
- Android: 15
- API: 35
- Architecture: aarch64
- Build fingerprint: `samsung/a14xmsq/a14xm:15/AP3A.240905.015.A2/A146USQSJEZH3:user/release-keys`
- RDC device name: `localhost`
- RDC device ID: `566d623e-df45-4b16-b2be-4cbd08567a49`
- Audit capture directory: `/sdcard/OmniKali/android-package-audit-20261001-130941`
- Audit method: live Android PackageManager inventory plus APK-path classification
- Canonical Broccoli Rish wrapper: unchanged

## Inventory

Live PackageManager inventory returned:

- 460 total packages
- 91 third-party packages
- 369 packages reported with the Android system-package classification

APK path classification across the complete inventory:

- 26 APEX
- 220 `/system`
- 12 `/system_ext`
- 47 `/product`
- 16 `/vendor`
- 76 `/data/app`
- 63 `/mnt/asec`

The path classification is evidence about the current installed location. It is **not** by itself proof that a package is stock, vendor-signed, unmodified, or safe.

## System-package finding

The 369 system-tagged packages are not all immutable base-image packages.

A second pass intersected the system-package list with package code paths:

- 321 system-tagged packages resolve from base partitions/APEX paths.
- 48 system-tagged packages resolve from `/data/app`.
- No system-tagged package was observed under `/mnt/asec`.

The 48 `/data/app` system-tagged packages include updated Google, Samsung, carrier, and Android framework components. Observed examples include:

- `com.android.chrome`
- `com.android.vending`
- `com.google.android.gms`
- `com.google.android.webview`
- `com.google.android.networkstack`
- `com.google.android.youtube`
- `com.google.android.captiveportallogin`
- `com.samsung.android.themestore`
- `com.samsung.android.scs`
- `com.sec.android.sbrowser`

Therefore future integrity/provenance checks must distinguish:

1. base-partition package
2. updated system package
3. ordinary third-party package
4. `/mnt/asec` package
5. APEX package

Do not label the 369 system packages as "stock" without signature, hash, version, installer/source, and firmware-baseline evidence.

## Execution-relevant installed packages

The live inventory contains:

- `app.morphe.manager`
- `app.morphe.android.youtube`
- `app.morphe.android.apps.youtube.music`
- `anddea.youtube.music`
- `app.revanced.android.gms`
- `app.revanced.manager.plugin.downloader.apkcombo`
- `moe.shizuku.privileged.api`
- `com.rosan.ruto`
- `org.autojs.autojs.modify`
- `com.agatamessina.webinspector`
- `com.northmendo.Appzuku`
- `io.github.muntashirakon.AppManager`
- `io.github.samolego.canta`

These are inventory observations, not endorsements.

## Termux add-on state

Present:

- `com.termux`
- `com.termux.api`
- `com.termux.gui`
- `com.termux.window`
- `com.termux.boot`
- `com.gardockt.termuxterminalwidget`
- `io.github.swiftstagrime.termuxrunner`

Absent from the live PackageManager inventory:

- `com.termux.float`
- `com.termux.styling`
- `com.termux.tasker`
- `com.termux.widget`
- `com.termux.x11`

Absent means **NOT_INSTALLED**, not **NOT_RELEVANT**.

Termux:Float, Termux:X11, and Termux:Styling remain candidate components for the human interaction plane. Installation and integration should be separately gated experiments.

## Rish/RDC boundary

Unprivileged RDC execution was sufficient to complete the PackageManager inventory.

A later attempt to invoke the canonical Rish wrapper from the RDC child timed out. This does not invalidate the established interactive-Termux Rish proof. It identifies the caller boundary `RDC child -> Rish` as separate from `interactive Termux -> Rish`.

The canonical Rish wrapper was not changed during this audit.

## Evidence labels

- Live Android package inventory: **PASS**
- Third-party/system counts: **PASS**
- System code-path classification: **PASS**
- 48 system-tagged packages outside base partitions: **PASS**
- Full stock/provenance determination: **NOT_PROVEN**
- Termux Float/X11/Styling exclusion: **NOT_APPLICABLE**
- Remote APK patch worker: **DESIGN_ONLY**
- Reproducible Morphe patch artifact pipeline: **NOT_PROVEN**

## Raw artifacts

The device-side audit directory contains:

- `packages-fui.txt`
- `third-party.txt`
- `system.txt`
- `system-paths.txt`
- `classified.tsv`
- `system-classified.tsv`
- `path-class-counts.txt`

The existing third-party package inventory remains in `docs/ANDROID_THIRD_PARTY_PACKAGES_2026-10-01.txt`.
