# Cloud Android agentic device

This runtime is the Android counterpart to the persistent desktop-session transport.

## Goal

Provide one persistent Android user session with two control planes:

1. User plane: noVNC/WebSocket screen transport so a physical Android browser can drive the same Android session.
2. Agent plane: authenticated ADB over a host-loopback-only port so Remote Desktop Commander, Ruto, Playwright/browser tooling, and other MCP-connected workers can automate the same session.

The Android VM owns its state in a persistent ext4 data image. Restarting the browser, WebSocket transport, or screen bridge must not destroy Android application state.

## Runtime

The reproducible seed is Android-x86 9.0-r2.

The runtime script:

- verifies the pinned ISO SHA-256 before use;
- extracts the kernel, initrd, Android ramdisk, and system squashfs;
- builds a small cloud-specific ramdisk;
- installs only the operator public ADB key at /adb_keys;
- enables authenticated root ADB;
- starts ADB after filesystem initialization and again after Android boot completion;
- exposes host ADB only on 127.0.0.1:5555;
- exposes QEMU VNC only on 127.0.0.1:5903;
- exposes websockify only on 127.0.0.1:6082;
- stores the persistent screen bearer token with mode 0600;
- keeps the screen token stable when websockify is restarted;
- keeps the Android data image stable across VM and browser reconnects.

## Security boundary

The cloud Android is intentionally powerful, but the dangerous control surfaces remain local:

- QEMU VNC is loopback-only.
- ADB is loopback-only.
- websockify is loopback-only.
- The ADB transport is authenticated with the operator key.
- No private ADB key is copied into the Android image.
- The existing protected workstation VNC credential is unrelated and is not touched.
- Public access must terminate at the existing authenticated HTTPS edge before proxying to the loopback websockify listener.

Do not publish TCP 5555 directly. ADB provides administrative control of the Android instance.

## Persistence contract

A browser/WebSocket reconnect is not an Android restart.

A websockify restart must reuse the existing token when its token state remains present.

The Android data image is never recreated by start when it already exists.

The user can therefore close and reopen the browser, lose the WebSocket connection, reconnect from the physical Android, or reconnect an MCP automation worker without losing the same Android application/session state.

## Agent contract

Representative control commands:

    scripts/cloud-android/persistent-device.sh adb get-state
    scripts/cloud-android/persistent-device.sh adb shell id
    scripts/cloud-android/persistent-device.sh adb shell input tap 100 200
    scripts/cloud-android/persistent-device.sh adb shell input text 'hello'
    scripts/cloud-android/persistent-device.sh adb shell screencap -p /sdcard/screen.png

ADB should report device, not offline, before the agent plane is considered ready.

The screen plane independently provides the user-drivable framebuffer.

## Acceptance gates

### Development transport

- [x] Android-x86 seed pinned and checksum verified.
- [x] Persistent data image exists.
- [x] Android GUI boots on KVM.
- [x] QEMU VNC is loopback-only.
- [x] Token-gated noVNC transport is implemented.
- [x] Physical/user screen path is architected as a reconnectable transport.
- [x] ADB reports device and accepts authenticated shell commands.
- [x] Agent input reaches the Android guest input path.
- [ ] Browser reconnect returns to the same Android state.
- [ ] Physical Android can open the same tokenized screen and drive the session.

### Production promotion

- [ ] Permanent authenticated HTTPS edge proxies the websockify HTTP and WebSocket paths.
- [ ] Edge reconnect/session refresh is verified.
- [ ] Public ADB remains unreachable.
- [ ] No temporary Quick Tunnel is used as production infrastructure.

## Current evidence boundary

The live cloud host has now proven the lower screen/input path independently:

- QEMU boots the Android-x86 guest.
- The VNC server answers the RFB handshake.
- Token-gated websockify serves noVNC.
- VNC keyboard events can switch the guest from the stale SeaBIOS framebuffer to the Android graphical surface.
- VNC pointer events reach the Android graphical surface.
- Restarting websockify preserves the QEMU guest and the bearer token; the Android session continues independently of the WebSocket transport.

The current implementation therefore does **not** treat the screen transport as broken.

The ADB agent plane is now **PASS for the development transport gate**. Live `adb connect 127.0.0.1:5555` reports `device`, the guest reports `sys.boot_completed=1` and `init.svc.adbd=running`, a fresh authenticated screenshot was captured at 1024x768, and ADB input completed successfully. See `docs/operations/CLOUD_ANDROID_R2_REVERIFICATION_2026-10-06.md`. Higher-level MCP automation is now gated on the authenticated gateway and capability-specific acceptance; R2 ADB and R3 Rish transport gates are proven.

The current live guest data image has a stable pre-change backup at:
`/root/.cloud-android/backups/data.img.pre-adbd-20261005`

The backup hash recorded after guest shutdown was:
`f74a5f939ac0a450e6ad0e001e2b30a48193f94ecc6002247896093e81b173bf`

