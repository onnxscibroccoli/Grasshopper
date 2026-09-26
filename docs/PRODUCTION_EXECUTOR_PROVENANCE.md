# Production executor provenance

Status: **partially resolved**.

## Exact deployed gateway executor

The live production file:

`/opt/helix/production/gateway/state/agent-executor.mjs`

has SHA-256:

`6c6346aee951eb139aa15fb7a5394bbd24bae5fab9a557a1f4f8d22d9ed3384e`

The exact same bytes exist in the live Helix Git object database at commit:

`357121db9496c6782c945499eaf3c90ea5ed9660`

Commit:

`feat: bind task runner to authenticated agent bridge`

Date: 2026-09-26 03:55 UTC.

The file was introduced by that commit. The later production startup-fix commits preserved the same file:

- `95966034f46f56f906e244f2ef42cc49253d99a8`
- `47f45d2b0542bd3a34579f333228567af903bc80`
- deployed checkout `46ba4b71158a74db5ede97e300099370792ecff8`

All three contain the same executor bytes and therefore the same SHA-256.

### Local implementation lineage

The live checkout contains the following task/executor chain:

1. `8ad0a925362c491591bfd394b46b7dc4574a63dc` — transactional task state engine
2. `e3e4eef25591a98bc4b211a938cde27eef3ddad0` — OmniKali execution task runner
3. `175bd7eed872f8b42a78485843ea829bf3175dc1` — bind task runner to authenticated agent bridge
4. `357121db9496c6782c945499eaf3c90ea5ed9660` — introduces `agent-executor.mjs`
5. `0061e44fc1663dd03d5605d6778bcc3d7f8d59b8` — OmniKali task dispatch worker
6. `d889632d7b1eebb15afa8a065772251192a94441` — authenticated task dispatch
7. `00b4b9f1aa45995b635fd719485ecac1495f44e0` — production control-plane database bootstrap
8. `4fbe832dfe3c535d666d96d1847f9a3c077976b0` — runtime WebSocket/noVNC dependencies
9. `e93bc0340509d5f203433b0924781af203ecdcd7` — load agent token for task runner
10. `95966034f46f56f906e244f2ef42cc49253d99a8` — initialize worker on gateway startup
11. `46ba4b71158a74db5ede97e300099370792ecff8` — deployed checkout

These commits are present in the production host's Git object database/reflog but are not currently represented by the visible GitHub `helix` history.

## Important distinction

The executor adapter is now provenance-resolved.

The execution service it calls is different:

`/opt/helix/production/agent/omni-agent.mjs`

Its deployed SHA-256 is:

`ee0a9898e706752098ef2dcce87b18cf577ff37e8726de3fb41721490078c46d`

The current file is untracked in the live checkout. Its exact blob is not present in the reachable or unreachable Git object set examined on the host, and `git log --all -- production/agent/omni-agent.mjs` returns no history.

Therefore the bridge implementation remains a production-local artifact requiring source recovery.

## Historical related implementation

GitHub history in `onnxscibroccoli/kali-node` independently documents an earlier one-node agent/orchestrator implementation:

- `0e1143a92f71381b1d37a07370560f39b5243ff7` — allowlisted headless jobs over loopback SSH and guest watchdog.
- `13e14970b9979ea2cd5aa2daa1863fada55d0dd8` — KVM agent / QEMU supervisor integration.

This establishes historical design lineage for agent execution and QEMU/KVM control, but it is **not** evidence that the current `omni-agent.mjs` was copied from those files.

## Reproducibility consequence

The accepted production behavior can now be traced through the actual task-control implementation much further than before.

The remaining provenance gap is specifically the runtime bridge implementation represented by `omni-agent.mjs`, plus any host-local service configuration required to run it.

Do not invent or substitute that bridge.

## Security

This record contains no secret values, tokens, cookies, passwords, private keys, or credential-bearing URLs.
