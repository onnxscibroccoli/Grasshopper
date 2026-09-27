# Production agent bridge recovery findings

Status: **source-authoring provenance resolved; exact artifact reconciliation resolved; canonical source designation remains gated**.

> **G6 / gate honesty:** “exact artifact reconciliation resolved” here means the *live host* artifact and authoring event are identified (SHA `ee0a9898…`). It does **not** unblock `executor_lineage` while `docs/PRODUCTION_EXECUTOR_LINEAGE_GATE.md` and `reference/production/helix-lineage-pin.json` say blocked, while Grasshopper hardening delta bytes diverge from live, or before Verify Gate ACCEPT on the live-pin + Helix import package. See Lineage `reference/production/overlays/live-pin/`.

## Exact authoring event

Production journal evidence shows the deployed bridge was authored directly through the authorized remote workstation control session on 2026-09-24.

Sequence:

1. 22:18:20 UTC: entropy-generation command.
2. 22:18:28 UTC: initial `write_file` targeting `/opt/helix/production/agent/omni-agent.mjs`.
3. 22:18:30 UTC: production agent directory creation.
4. 22:18:36 UTC: bridge source write.
5. 22:18:38 UTC: source append.
6. 22:18:40 UTC: source append.
7. 22:18:42 UTC: source append.
8. 22:18:44 UTC: `/etc/helix/agent.env` creation.
9. 22:18:48 UTC: `/etc/systemd/system/omni-agent.service` creation.
10. 22:18:50 UTC: `/opt/helix/production/agent/openapi.yaml` creation.
11. 22:18:57 UTC: nginx `/agent/` reverse proxy addition.
12. 22:18:59 UTC: systemd reload/start and nginx reload.
13. 22:19:03 UTC: local health and authenticated execution test.
14. 22:19:06 UTC: external HTTPS health test.
15. 22:19:13-22:19:22 UTC: gateway agent-proxy integration and restart.

This resolves the apparent missing source event: the bridge was authored directly on the production host rather than deployed from an undiscovered GitHub commit.

## Exact deployed artifact

- path: `/opt/helix/production/agent/omni-agent.mjs`
- SHA-256: `ee0a9898e706752098ef2dcce87b18cf577ff37e8726de3fb41721490078c46d`
- size: 4040 bytes
- owner: root:root
- mode: 0644
- filesystem birth: 2026-09-24 22:18:36 UTC
- modification: 2026-09-24 22:18:42 UTC

The source implements loopback HTTP, bearer authentication, bounded request size, `/health`, authenticated `POST /execute`, command/cwd/timeout validation, QEMU `guest-exec`, `guest-exec-status`, captured output, timeout bounds, and UUID execution logging.

It does not implement durable operation identity, durable cancellation, cancellation acknowledgement, executor-side idempotency, or durable execution receipts.

## Exact artifact reconciliation

Grasshopper preserves the recovered bridge at:

`reference/production/deployed/omni-agent.mjs`

The committed artifact was verified byte-for-byte against the live production file:

`/opt/helix/production/agent/omni-agent.mjs`

Verification result:

- SHA-256 matches exactly;
- size matches exactly at 4040 bytes;
- byte comparison returned exact equality;
- the production-artifact validator passed its credential scan and execution-boundary checks.

The fingerprint is recorded in:

`reference/production/deployed/omni-agent.sha256`

## Companion artifacts

The same authoring sequence created:

- `/opt/helix/production/agent/openapi.yaml`
- `/etc/systemd/system/omni-agent.service`
- `/etc/helix/agent.env`
- nginx `/agent/` reverse proxy
- gateway agent-proxy integration

## Security finding

The original authoring event placed the bearer credential directly in the host environment file and the remote-tool journal metadata.

This conflicts with the current Grasshopper security invariant that production credentials must not appear in source, logs, fixtures, prompts, commits, or generated artifacts.

The credential value is intentionally omitted from this record.

The reproducible deployment contract now requires an agent secret-manager reference rather than an agent-token payload.

The live instance currently has no discoverable agent secret reference available through its existing AWS secret listing path, so no production credential mutation has been attempted.

Correct remediation remains controlled credential rotation and secret-manager-backed runtime injection, followed by the complete acceptance suite.

## Historical relationship

Earlier timestamped restore-point MCP implementations use the same QEMU guest-agent mechanism, but they were created later than this bridge. They are historical implementation context, not its direct source.

## Git boundary

The gateway task executor has a separate resolved local Git lineage documented in `docs/PRODUCTION_EXECUTOR_PROVENANCE.md`.

The agent bridge itself was authored directly on the production host and is not represented by a canonical Git commit.

Therefore:

- executor provenance: Git-resolved
- agent bridge source-authoring provenance: runtime-session-resolved
- agent bridge exact artifact: byte-resolved
- agent bridge canonical source designation: controlled import still required

## Reconstruction consequence

The bridge should now be treated as a recovered production-local implementation, not an unexplained artifact.

The exact source is preserved and fingerprinted. The next implementation gate is to designate the canonical source location and reproduce it from clean automation, then apply executor hardening without replacing the validated QEMU execution boundary.

No production mutation was performed during this investigation.
