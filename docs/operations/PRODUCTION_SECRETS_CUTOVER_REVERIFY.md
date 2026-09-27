# Live production secrets cutover re-verification checklist

Status: **inventory / procedure only**. This document does **not** authorize production mutation, credential rotation/deletion, or claim that live cutover is complete.

Gate: `production_secrets_cutover` remains **OPEN** until an authorized operator completes the host evidence below and records a **dated** acceptance in repository docs. PR #16 migration notes in [AGENT_SECRET_MIGRATION.md](./AGENT_SECRET_MIGRATION.md) are historical evidence only.

Repository contract gate `secrets_injection_contract` is separate and may already be **COMPLETE** from loader, drop-ins, docs, and tests on `main`.

## Live path (authoritative after PR #16)

Do not rewrite these without ops approval:

| Item | Value |
|------|--------|
| Secret id (reference only) | `omnikali/production/agent-bridge-token` |
| Host env reference | `HELIX_AGENT_TOKEN_SECRET_ID` |
| Runtime loader | `src/production/agent-secret.mjs` (`loadAgentBridgeToken`) |
| systemd drop-ins (reference copies) | `reference/production/deployed/omni-agent.service.d/20-agent-secret.conf`, `reference/production/deployed/helix-gateway.service.d/20-agent-secret.conf` |

Deployment automation must carry only secret references. Never commit or paste `AGENT_TOKEN` payloads, secret `SecretString` values, or other credential material into this repository, logs, or prompts.

## Clean-host reconstruction path (not live)

These are for clean-host reconstruction only. Do **not** treat them as the current live cutover path, and do **not** align the live secret payload to this shape without an approved cutover:

- Launcher: `scripts/start-omni-agent-from-secret.sh`
- Env reference: `OMNIKALI_AGENT_SECRET_ID`
- Documented payload shape: JSON `{"AGENT_TOKEN":"<secret>"}` (placeholder only; see [AGENT_SECRET_CONTRACT.md](../AGENT_SECRET_CONTRACT.md))

## Hard stops (require explicit Ian authorization)

- Production host mutation beyond read-only observation
- Credential rotate / delete / create
- AWS write mutations (IAM policy changes, secret updates, etc.)
- Claiming `production_secrets_cutover` **COMPLETE** without dated live evidence
- Introducing Neon as production persistence
- Re-merging PR #32

## Host evidence checklist (read-only / observe)

Record UTC and America/New_York timestamps for every probe. Prefer redacted command output (secret values must never appear).

1. **Drop-ins installed** — live `omni-agent` and `helix-gateway` drop-ins set `HELIX_AGENT_TOKEN_SECRET_ID=omnikali/production/agent-bridge-token` (reference only).
2. **No static host env token** — unit files and `/etc/helix/agent.env` (or equivalent) do not contain `AGENT_TOKEN=`.
3. **Live process environment** — running `omni-agent` and `helix-gateway` process environments do not carry a static `AGENT_TOKEN` injection from host env files.
4. **Secrets Manager fetch smoke** — instance execution identity can read the secret id via `GetSecretValue` (or the approved loader path). Do not log or paste the secret value.
5. **Services active** — both units active; restart counts stable after the observation window.
6. **Health** — both health endpoints return `ok: true`.
7. **Functional path** — one authenticated gateway → agent bridge → QEMU guest execution returns exit code 0.
8. **Artifact secret boundary** — host bridge artifact still uses `loadAgentBridgeToken`, does not embed `AGENT_TOKEN=`, and passes the same forbidden-credential patterns as `scripts/validate-production-agent-artifact.mjs`.
9. **IAM least-privilege (observe)** — role allows only `secretsmanager:GetSecretValue` and `secretsmanager:DescribeSecret` against that secret namespace (plus KMS decrypt required by the secret when a customer-managed key is used). No list/create/rotate/modify secrets; no IAM administration from the bridge role. If `iam:ListRolePolicies` is denied from the instance, record the denial; do not invent policy documents.

## Acceptance handoff

Full production acceptance (duplicate-side-effect fencing, worker interruption/recovery, gateway restart, database/network failure) belongs with live readiness / acceptance owners after items 1–9 pass. Secrets cutover re-verification does not by itself close acceptance automation gates.

## Closing the static gate (docs only, after live evidence)

`scripts/verify-agentic-deploy-readiness.mjs` assesses `production_secrets_cutover` from `docs/PRODUCTION_RECONSTRUCTION_STATUS.md` and `docs/operations/AGENT_SECRET_MIGRATION.md` only. It stays **OPEN** until those docs record a fresh, authorized live host check.

Required content shape (see `assessProductionSecretsCutover` in `scripts/verify-agentic-deploy-readiness.mjs`):

1. Wording that a live host was re-verified against the Secrets Manager injection path (the live env ref `HELIX_AGENT_TOKEN_SECRET_ID`), and
2. An explicit dated completion claim using the verifier's expected completion sentence (the contiguous "dated live cutover re-verification" + "complete" claim).

**Do not** write that completion claim into status or migration docs until an authorized operator has finished the host evidence above and Ian has authorized recording it. Documenting the requirement here must not itself satisfy the gate. This checklist file is intentionally not a positive completion record.

## Related

- [AGENT_SECRET_MIGRATION.md](./AGENT_SECRET_MIGRATION.md) — historical #16 cutover notes
- [AGENT_SECRET_CONTRACT.md](../AGENT_SECRET_CONTRACT.md) — clean-host contract
- [PRODUCTION_AGENT_SECRET_RECONSTRUCTION.md](../PRODUCTION_AGENT_SECRET_RECONSTRUCTION.md) — reconstruction harness (not live acceptance)
- [AGENTIC_DEPLOY_READINESS.md](../AGENTIC_DEPLOY_READINESS.md) — static fail-closed gate overview
- [`test/fixtures/secrets-cutover/`](../../test/fixtures/secrets-cutover/) + `npm run verify:secrets-cutover-dryrun` — synthetic dry-run doc fixtures for the cutover assessor (does **not** close the live gate)

