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

## Agent bridge provenance finding

The deployed QEMU execution bridge:

`production/agent/omni-agent.mjs`

has SHA-256:

`ee0a9898e706752098ef2dcce87b18cf577ff37e8726de3fb41721490078c46d`.

It is not represented by a Git commit, but its source-authoring event is now directly established by the production host journal.

The exact authoring sequence began at 22:18:28 UTC on 2026-09-24 and wrote the bridge in several remote `write_file` operations. The companion environment, systemd unit, OpenAPI contract, nginx proxy, service activation, health test, and gateway proxy integration immediately followed.

Therefore the bridge is no longer an unexplained artifact or an unknown deployment package. It was directly authored on the production host.

This resolves **source-authoring provenance**, but not canonical Git provenance.

See `docs/PRODUCTION_AGENT_BRIDGE_RECOVERY.md`.

## Security provenance finding

The original authoring operation placed the bridge bearer credential into a host environment file and exposed it in remote-tool journal metadata. The value is intentionally not recorded in Grasshopper.

This is a known hardening violation against the current secret-management invariant. Remediation requires controlled credential rotation and secret-manager-backed runtime injection, followed by the complete acceptance suite.

No production credential mutation was performed during provenance recovery.

## Historical related repositories

GitHub history in `onnxscibroccoli/kali-node` documents earlier OmniKali execution/control work, including:

- `0e1143a92f71381b1d37a07370560f39b5243ff7` — one-node allowlisted headless jobs over loopback SSH plus guest watchdog.
- `13e14970b9979ea2cd5aa2daa1863fada55d0dd8` — KVM agent/QEMU supervisor integration.
- `043985d2ab12d685b5c2b5adbd351fdc938c2b13` — authenticated RFB gateway to persistent Kali KVM guest.

These establish historical implementation lineage, but not direct source derivation of the current bridge.

## Migration reconciliation

The accepted Helix revision contains the authoritative numbered migration chain:

1. `0001_auth.sql`
2. `0002_workspaces.sql`
3. `0003_stream.sql`
4. `0004_omnikali_tasks.sql`

Those files were recovered into `reference/production/helix-accepted/migrations/` as evidence copies. They are not a replacement for the Helix source repository.

The live production migration ledger contains the same four filenames in the same order. The live migration SHA-256 evidence differs from the clean accepted-source artifacts. This remains a source/runtime drift gate.

## Remaining reconstruction gates

The exact bridge has since been preserved at `reference/production/deployed/omni-agent.mjs` and designated canonical source at `src/production/omni-agent.mjs` (see `PRODUCTION_RECONSTRUCTION_STATUS.md`). These completed source steps do not close the full-stack release gate. Remaining steps are:

1. Establish deterministic build/deployment artifact hashes for the full stack and reconcile the dirty checkout and differing live migration bytes.
2. Reconstruct on a clean target, including host services and their dependencies.
3. Run readiness and full acceptance.
4. Establish rollback/recovery evidence.
5. Rotate the bridge credential and move runtime injection to the required secret-management boundary.

Until those gates pass, production mutation remains disabled by the reconstruction manifest.

## Safety

No passwords, credential values, bearer tokens, cookies, private keys, or secret payloads are recorded here.
