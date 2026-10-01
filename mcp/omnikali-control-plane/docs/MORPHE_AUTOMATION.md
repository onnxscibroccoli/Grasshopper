# Morphe automation contract

## Boundary

Morphe is an Android application controlled by the OmniKali MCP through the existing Broccoli Rish transport. The workstation must not impersonate the Android execution environment.

## Source trust

Sources are represented by `src/morphe.mjs` with an explicit evidence label. `VERIFIED_SIGNED_RELEASE_METADATA` means the public repository documents signed `.mpp` release metadata. `REPO_VERIFIED_BUILDABLE_NOT_SIGNATURE_VERIFIED` means the repository documents reproducible builds, but this project has not independently verified a release signature.

A fork on `onnxscibroccoli` is the preferred control-plane reference when the upstream license permits it. Forking does not make an upstream source trustworthy by itself. The recorded upstream and fork identities must remain auditable.

## Human boundary

`morphe.source.prepare` only opens Morphe's documented add-source flow. `morphe.batch.prepare` only opens Morphe's documented batch preflight. Morphe's own confirmation and Start patching controls remain human-required.

No tool bypasses CAPTCHA, MFA, biometric approval, payment approval, or Morphe's explicit patch confirmation.

## App optimization loop

`catalog -> inspect -> source eligibility -> prepare -> human confirmation -> patch -> install -> observe -> verify -> record`

The device-specific optimization plan is advisory until the resulting application passes functional and automation regression checks. Rollback is required before an existing working application is removed.

## Current source registry

- `hoodles` -> `onnxscibroccoli/morphe-patches`
- `kareem` -> `onnxscibroccoli/morphe-patches-1`
- `alastor` -> `onnxscibroccoli/Morphe-Patches-2`

The current registry deliberately does not label the Alastor source as signature-verified.
