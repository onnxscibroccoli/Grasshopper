# Production source lineage reconciliation

Status: **partially resolved; reconstruction still gated**.

## Authoritative references

- Application repository: `onnxscibroccoli/helix`
- Accepted production-fix revision: `38903b021cca75189a99e1ed88b508bae577f048`
- Current Helix `main`: `a7cb8dc98b1cc668c1e481a845a48af004c4f510`
- Observed deployed checkout: `46ba4b71158a74db5ede97e300099370792ecff8`
- Deployed checkout state: dirty

The accepted revision remains the source-of-truth reference for validated production behavior. The observed deployed checkout is runtime evidence, not a clean release artifact.

## GitHub lineage finding

GitHub comparison of the accepted production-fix revision against current Helix `main` reports `main` as 28 commits behind the accepted revision. Therefore current `main` is not a descendant of the accepted production-fix revision and cannot be used by itself as the clean reconstruction source for the accepted production state.

The exact deployed checkout is not present as a visible GitHub commit.

## Production-host Git lineage finding

The production checkout contains local branches, reflog entries, and unreachable Git commits that were not visible through the GitHub repository history.

The task/executor implementation has now been traced through those local Git objects:

- `8ad0a925362c491591bfd394b46b7dc4574a63dc` — transactional task state engine
- `e3e4eef25591a98bc4b211a938cde27eef3ddad0` — OmniKali execution task runner
- `175bd7eed872f8b42a78485843ea829bf3175dc1` — bind task runner to authenticated agent bridge
- `357121db9496c6782c945499eaf3c90ea5ed9660` — introduces the exact deployed `agent-executor.mjs`
- `0061e44fc1663dd03d5605d6778bcc3d7f8d59b8` — task dispatch worker
- `d889632d7b1eebb15afa8a065772251192a94441` — authenticated task dispatch
- `00b4b9f1aa45995b635fd719485ecac1495f44e0` — production control-plane database bootstrap
- `4fbe832dfe3c535d666d96d1847f9a3c077976b0` — runtime websocket/noVNC dependencies
- `e93bc0340509d5f203433b0924781af203ecdcd7` — load agent token for task runner
- `95966034f46f56f906e244f2ef42cc49253d99a8` — gateway startup worker initialization
- `46ba4b71158a74db5ede97e300099370792ecff8` — deployed checkout

The deployed `agent-executor.mjs` SHA-256 exactly matches the blob in `357121db9496c6782c945499eaf3c90ea5ed9660`.

This resolves the provenance of the executor adapter.

## Remaining runtime artifact gap

The deployed execution service:

`production/agent/omni-agent.mjs`

has SHA-256:

`ee0a9898e706752098ef2dcce87b18cf577ff37e8726de3fb41721490078c46d`.

It is untracked in the production checkout, has no Git history in the checkout, and its exact blob was not found in the unreachable Git object set examined.

Therefore the executor adapter is provenance-resolved, but the actual QEMU guest-execution bridge remains a production-local artifact requiring source/build provenance recovery.

The same provenance rule applies to the production gateway launcher and systemd database-secret overlay.

See `docs/PRODUCTION_EXECUTOR_PROVENANCE.md`.

## Historical related repositories

GitHub history in `onnxscibroccoli/kali-node` also documents earlier OmniKali execution/control work, including:

- `0e1143a92f71381b1d37a07370560f39b5243ff7` — one-node allowlisted headless jobs over loopback SSH plus guest watchdog.
- `13e14970b9979ea2cd5aa2daa1863fada55d0dd8` — KVM agent/QEMU supervisor integration.
- `043985d2ab12d685b5c2b5adbd351fdc938c2b13` — authenticated RFB gateway to persistent Kali KVM guest.

These establish documented historical implementation lineage, but they are not evidence that the current `omni-agent.mjs` was copied from them.

## Migration reconciliation

The accepted Helix revision contains the authoritative numbered migration chain:

1. `0001_auth.sql`
2. `0002_workspaces.sql`
3. `0003_stream.sql`
4. `0004_omnikali_tasks.sql`

Those files were recovered into `reference/production/helix-accepted/migrations/` as evidence copies. They are not a replacement for the Helix source repository.

The live production migration ledger contains the same four filenames in the same order. The live migration SHA-256 evidence differs from the clean accepted-source artifacts. This remains a source/runtime drift gate.

## Required next gate

An authorized automation workflow must establish:

1. exact provenance for `omni-agent.mjs`;
2. exact provenance for the gateway launcher and systemd database-secret overlay;
3. the clean Helix release boundary containing the recovered task/executor chain;
4. deterministic build/deployment artifact hashes;
5. readiness and full acceptance on a reconstruction target;
6. rollback/recovery evidence from that clean artifact.

Until those gates pass, production mutation remains disabled by the reconstruction manifest.

## Safety

This document contains no passwords, credential-bearing URLs, tokens, cookies, private keys, or secret values. Evidence copies must never become a second source of truth.
