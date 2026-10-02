# Android / Termux Execution Inventory - 2026-10-01

Live phone evidence captured through the canonical Broccoli Rish wrapper.

## Device
- Android 15
- Samsung SM-A146U
- API 35
- aarch64
- 48 GB data, 6.7 GB free, 86% used at inspection

## Termux
- Termux 0.118.3
- Termux:API 0.53.0
- Termux:GUI 0.1.6
- Termux:Window 0.17.0
- Termux:Boot 0.8.1
- Third-party widget: com.gardockt.termuxterminalwidget 1.3
- Third-party runner: io.github.swiftstagrime.termuxrunner 1.8.2

Not observed:
- Termux:Widget
- Termux:Float
- Termux:Styling
- Termux:Tasker
- Termux:X11

## Boot
- ~/.termux/boot/broccoli-supervisor
- ~/.termux/boot/start_sd_transfer.sh
- ~/.shortcuts exists and is empty
- ~/.shortcuts/tasks exists and is empty

## Package inventory
460 total packages:
- 91 third-party
- 369 system

Third-party package list is recorded verbatim in ANDROID_THIRD_PARTY_PACKAGES_2026-10-01.txt.

## Automation state
- Shizuku 13.6.0.r1086.2650830c
- WRITE_SECURE_SETTINGS granted
- accessibility services setting: null
- default IME: Samsung HoneyBoard
- Termux:API is an enabled notification listener
- Rish: PASS
- identity: uid=2000(shell)
- SDK: 35

The null accessibility setting is not currently a blocker. Canonical Rish can invoke uiautomator directly.

## Direct UI evidence
- pm path com.sec.android.app.popupcalculator succeeded
- APK path: /mnt/asec/com.sec.android.app.popupcalculator-81bA25YJ0GYMWypp/base.apk
- uiautomator dump succeeded
- UI XML: 59,118 bytes
- hierarchy foreground package: com.openai.chatgpt

The old RDC uiautomator timeout is therefore not evidence that Android UI automation is broken.

## APK inspection
Installed after checking storage:
- aapt2 16.0.0.4-2
- apktool 3.0.3
- jadx 1.5.6
- OpenJDK 21

Calculator APK proof:
- package: com.sec.android.app.popupcalculator
- version: 12.3.05.8
- versionCode: 1230508000
- target/compile SDK: 34
- permissions: 8
- decoded layouts: 126
- resource-id references: 355
- classes.dex: present
- native libraries: 2

## Implementation blocker fixed
Grasshopper PR #115 referenced tools/apk_inspector.py but the file did not exist.

Added deterministic inspector:
- AAPT2 metadata/permission extraction
- APK ZIP inventory
- optional Apktool layout decoding
- resource-id extraction
- literal text extraction
- bounded subprocess execution

The MCP check gate now compiles the inspector.

Verification:
- npm test: 14/14 PASS
- npm run check: PASS
- live Calculator APK inspection: PASS

## Status
PROVEN:
- canonical Rish transport
- Android shell identity
- live uiautomator through canonical Rish
- APK discovery and transfer
- static APK inspection
- real layout discovery
- MCP test and syntax gates

NOT_PROVEN:
- MCP observe -> semantic select -> mutating action -> post-action verification
- human-gate checkpoint -> local completion -> automatic resume
- post-reboot recovery
- force-stop recovery
- Morphe source confirmation
- Morphe source build

## Boundary decision
B2 is now classified as MCP/UI-executor integration.

Do not modify lib/rish_run.sh to solve B2.

## Next gate
observe -> static app map -> semantic locate -> one safe action -> reobserve -> verify

Then:
HUMAN_GATE_DETECTED -> checkpoint -> live UI handoff -> WAITING_FOR_HUMAN -> completion detection -> reobserve -> automatic resume
