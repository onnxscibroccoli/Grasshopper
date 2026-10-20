# Mobile device evidence + MVP scope (2026-10-19 ~20:50 ET)

Source: Ian, local run. **One device only.** Fail-closed: nothing below claims COMPLETE beyond this dated Samsung evidence.

## Verified facts (SM-A146U, Android 15 / SDK 35, Shevery 14.2.0)

| Item | Value |
|------|-------|
| MobileMCP APK | v0.6.0 installed (`onnxscibroccoli/mobilemcp` app) |
| Connection | `ws://127.0.0.1:17692` (on-device loopback hub) |
| Device id | `c1f33361d8d5412ba44cb8653f33025b` |
| `get_command_access` | `enabled=true`, `shizukuRunning=true`, `shizukuGranted=true` |
| `run_phone_command(["id"])` | exitCode `0`, `uid=2000(shell)`, SELinux `u:r:shell:s0` |
| Root | unavailable (non-root by design) |

What this proves: mobilemcp's Shizuku UserService path executes a bounded non-mutating command as `shell` on this device.

Not proven: control-plane mediation, broccoli-core integration, remote (non-loopback) access, reboot survival, `live_device_acceptance` for broccoli-core #77 (still `NOT_RUN`).

## Scope decisions (Ian)

1. **OEM matrix (Xiaomi / OnePlus / Pixel) is out of MVP scope.** Others may test and report; not chased now.
2. **Persistence:** Shevery/Wireless ADB is started manually each reboot (Wi-Fi or ADB). Non-negotiable. **No vulnerability hunting** for persistence now; vuln testing is automated only after MVP basic functionality is demonstrated.
3. Proceed with broccoli-core integration and Grasshopper control-plane hooks.
4. Hybrid controller setup proceeds.
5. Rish wire must support controllers other than Termux.

## Status

| Item | Status |
|------|--------|
| broccoli-core #77 hybrid controller | MERGED `f66678ea9749c6c22519028c39dc00d5c9e3bae1`; device acceptance NOT_RUN |
| Grasshopper #197 mTLS edge client | Draft, CONFLICTING — needs rebase |
| broccoli-rish #1 (core owns physical rish) | Open draft, MERGEABLE |
| Rish wire (`agent_wire_rish.sh` et al.) | Termux-only today; multi-controller update NOT STARTED |
| Upstream `@mobilenext/mobile-mcp@1.0.12` | stdio start only; not canonical |

## Minimal next steps (atomic, fail-closed, in order)

1. **Pick canonical:** `onnxscibroccoli/mobilemcp` v0.6.0 is the device driver (evidenced). Upstream mobile-mcp stays out unless chosen later.
2. **Contract doc:** define the action envelope `{device_id, tool, argv, mutating, request_id}` that Grasshopper evaluates. Default unknown tools to Block.
3. **Grasshopper hook:** pre-execution policy `Allow | Block | Escalate` for `run_phone_command`; allowlist read-only argv (`id`, `getprop`, `dumpsys` read paths) first; everything mutating → Escalate. Unit tests + negatives.
4. **broccoli-core adapter:** controller calls mobilemcp only via the hook-approved envelope; never directly from model output. Record `request_id` + outcome in the idempotent command ledger (#77). `COMMAND_OUTCOME_UNKNOWN` is never auto-replayed.
5. **Rish wire multi-controller:** replace Termux-only assumption with an explicit controller registry (package id + expected uid 2000 + transport), fail-closed when the caller isn't registered. Tests for Termux + mobilemcp + hybrid controller.
6. **Rebase #197** onto main; re-run Android Controller workflow.
7. **Dated device probe** through the full chain (model → Grasshopper hook → broccoli-core → mobilemcp → `id`). Only then flip `live_device_acceptance` for that one device.

## Hard stops

No production mutate, credential rotate/delete, AWS/RDS live changes, live secrets/Helix cutover, overwriting the live checkout, or exposing the `17692` hub beyond loopback without Ian's explicit go-ahead. No secrets in source. No Neon. No persistence-vuln hunting before MVP.

## ChatGPT successor seed

```
You are continuing Grasshopper/OmniKali mobile work for Ian Cossette.
Repos: onnxscibroccoli/Grasshopper (control plane), onnxscibroccoli/broccoli-core (hybrid controller, PR #77 merged f66678ea), onnxscibroccoli/mobilemcp (device driver, APK v0.6.0), onnxscibroccoli/broccoli-rish.
Read first: Grasshopper docs/orchestration/MOBILE_EVIDENCE_2026-10-19.md, HANDOFF_2026-10-19.md, IMPLEMENTATION_SEED.md.
Proven 2026-10-19 ~20:50 ET on ONE device (samsung SM-A146U, Android 15, Shevery 14.2.0): mobilemcp v0.6.0 at ws://127.0.0.1:17692, device id c1f33361d8d5412ba44cb8653f33025b; get_command_access enabled/shizukuRunning/shizukuGranted all true; run_phone_command(["id"]) exit 0 uid=2000(shell) SELinux u:r:shell:s0. Root unavailable.
Not proven: control-plane mediation, broccoli-core integration, remote access, reboot survival, live_device_acceptance (still NOT_RUN).
Scope: OEM matrix out of MVP. Persistence = manual Shevery start each reboot; do not hunt vulns. Next: action envelope contract, Grasshopper Allow/Block/Escalate hook for run_phone_command (read-only allowlist first), broccoli-core adapter via the hook only, multi-controller rish registry (not Termux-only), rebase Grasshopper #197, then one dated end-to-end probe.
Rules: fail-closed; freeze proven core; no Neon; no secrets in source; merge only after green CI + verification; never claim COMPLETE without dated evidence.
Hard stops without Ian: prod mutate, credential rotate/delete, AWS/RDS live, live secrets/Helix cutover, overwrite live checkout, exposing port 17692 beyond loopback.
Report verified facts only with PR numbers and SHAs.
