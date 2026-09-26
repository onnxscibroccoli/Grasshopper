# Production agent bridge recovery findings

Status: **provenance gap narrowed; exact source still not recovered**.

## Exact deployed artifact

Production runtime:

- path: `/opt/helix/production/agent/omni-agent.mjs`
- SHA-256: `ee0a9898e706752098ef2dcce87b18cf577ff37e8726de3fb41721490078c46d`
- size: 4040 bytes
- owner: root:root
- mode: 0644
- filesystem birth: 2026-09-24 22:18:36 UTC
- modification: 2026-09-24 22:18:42 UTC

The matching service unit:

`/etc/systemd/system/omni-agent.service`

was created at 2026-09-24 22:18:48 UTC.

The service description is `OmniKali authenticated remote agent bridge`. It binds loopback HTTP on `127.0.0.1:8093`, authenticates with `AGENT_TOKEN`, and executes commands through libvirt QEMU guest-agent against `helix-omnikali`.

## Runtime evidence

Systemd journal shows the bridge started at 2026-09-24 22:19:00 UTC, immediately after the artifact and unit were created.

The service has subsequently executed the real OmniKali acceptance commands, including the gateway E2E marker and the worker-interruption recovery marker. These journal entries establish runtime use, not source provenance.

## Restore-point discovery

The production checkout contains timestamped untracked restore points from the following day:

- `20260924T235318Z`
- `20260925T021500Z-mcp-handler-adapter`
- `20260925T023000Z-gemini-mcp-wire-diagnostic`
- `20260925T-grok-mcp-schema-exit-parser`

They contain `omni-mcp.mjs` implementations using the same QEMU guest-agent mechanism:

- `virsh -c qemu:///system qemu-agent-command`
- `guest-exec`
- `guest-exec-status`
- `capture-output`
- persistent tmux sessions
- machine state and concurrency locks

The restore-point `omni-mcp.mjs` files have distinct hashes and are not byte-identical to `omni-agent.mjs`.

The deployed `omni-agent.mjs` predates those restore points by approximately one hour. Therefore the restore points are strong **historical implementation context** for the QEMU execution boundary, but they are not proof that the deployed bridge was derived from them.

## Exact implementation relationship

The current bridge is a deliberately smaller HTTP service:

1. authenticated POST `/execute`
2. request validation
3. UUID execution identity for logging
4. `virsh qemu-agent-command`
5. QEMU `guest-exec`
6. polling with `guest-exec-status`
7. captured stdout/stderr
8. bounded command timeout
9. JSON response

It does **not** provide durable operation identity, durable cancellation, durable execution receipts, or executor-side idempotency.

The earlier restore-point MCP implementation contains more stateful task/lock functionality. Similarity of the underlying QEMU mechanism is established; exact source derivation is not.

## Local Git boundary

The production checkout contains a separate, fully traceable Git lineage for the gateway task executor:

`8ad0a925 -> e3e4eef2 -> 175bd7ee -> 357121db -> 0061e44f -> d889632d -> 00b4b9f1 -> 4fbe832d -> e93bc034 -> 95966034 -> 46ba4b71`

The exact deployed `agent-executor.mjs` is contained in that lineage.

By contrast, `production/agent/omni-agent.mjs` is untracked and has no path history. Its exact SHA was not found in the live checkout's reachable or unreachable Git object set.

## Repository-wide research

Searches across the accessible `onnxscibroccoli` GitHub repositories did not find the exact `omni-agent.mjs` source, `127.0.0.1:8093` implementation, or `omni-agent.service`.

GitHub history in `onnxscibroccoli/kali-node` does contain earlier KVM/QEMU agent work, including:

- `0e1143a92f71381b1d37a07370560f39b5243ff7`
- `13e14970b9979ea2cd5aa2daa1863fada55d0dd8`
- `043985d2ab12d685b5c2b5adbd351fdc938c2b13`

Those are historical lineage evidence only.

## Reconstruction decision

Do not promote `omni-agent.mjs` into canonical source merely because its behavior resembles the earlier MCP implementation.

The correct next provenance targets are:

1. the deployment operation that created the artifact at 22:18 UTC on 2026-09-24;
2. host-local deployment scripts/configuration that may have generated or copied it;
3. any external source archive or release artifact referenced by that deployment;
4. the exact source/build input from which SHA `ee0a9898...` can be reproduced.

Until one of those establishes provenance, the bridge remains a runtime-local evidence artifact.

## Security

No credential values, bearer tokens, cookies, private keys, or secret payloads are recorded here.
