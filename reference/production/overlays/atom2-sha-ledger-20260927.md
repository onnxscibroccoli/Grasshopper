# Atom 2 SHA-256 ledger (LOCKED) — 2026-09-27

**Status:** LOCKED by Executor Dept G1/G6 + Lineage cross-check. Do not invent hashes.  
**Zone:** America/New_York (ET)  
**Verified at:** 2026-09-27T02:47:18-04:00 (ET)

## LIVE digests (production host evidence; close G1 only on these)

| Artifact | Live host path | SHA-256 | Size |
| --- | --- | --- | --- |
| `omni-agent.mjs` | `/opt/helix/production/agent/omni-agent.mjs` | `ee0a9898e706752098ef2dcce87b18cf577ff37e8726de3fb41721490078c46d` | 4040 B |
| `agent-executor.mjs` | `/opt/helix/production/gateway/state/agent-executor.mjs` | `6c6346aee951eb139aa15fb7a5394bbd24bae5fab9a557a1f4f8d22d9ed3384e` | (size not re-measured this run; live SHA from Executor/docs) |

Sources for LIVE digests (documentation only; this agent did not re-read the live host):
- `docs/PRODUCTION_EXECUTOR_PROVENANCE.md`
- `docs/PRODUCTION_LIVE_EVIDENCE.md`
- `docs/PRODUCTION_RUNTIME_DELTA_INVENTORY.md`
- `docs/PRODUCTION_AGENT_BRIDGE_RECOVERY.md`
- `reference/production/deployed/omni-agent.sha256` (fingerprint still records live omni digest)

## Grasshopper tip delta (intentional local hardening — NOT live — NOT G1 close)

Tip paths: `reference/production/deployed/` and `src/production/` on Grasshopper `main` @ `edad26695a010fbf564a66b7706b20d9c145b36d`.

| Artifact | Tip path | SHA-256 | Size |
| --- | --- | --- | --- |
| `omni-agent.mjs` | `reference/production/deployed/omni-agent.mjs` (= `src/production/omni-agent.mjs`) | `ffd3d5981cb8cc749cb112d312018b119c95e5613376f1695c59e226aed9b349` | 4223 B |
| `agent-executor.mjs` | `reference/production/deployed/agent-executor.mjs` (= `src/production/agent-executor.mjs`) | `d1ad94d942ebfd0898c79a18d649b5628bb7a31ce10cdbaf01cf57e4353758c2` | 1056 B |

Validators on tip pin the **delta** digests (`scripts/validate-canonical-agent-source.mjs`, `validate-canonical-agent-executor.mjs`, `validate-production-agent-artifact.mjs`).

Divergence introduced by Grasshopper `#17` / `de8817197f8450c8160679e6e1d728e0e82199ec` (“reconcile provenance after Secrets Manager hardening”).

## Helix acceptance tree

| Check | Result |
| --- | --- |
| Pin | `38903b021cca75189a99e1ed88b508bae577f048` |
| Tag | `clean-reconstruction-38903b0` (tag object `6ef4db852a945d957b1e577327d6260bdd693197`) |
| `agent-executor.mjs` / `omni-agent.mjs` in tree | **ABSENT** |
| Host SHAs `46ba4b7…` / `357121d…` in Helix GitHub | **ABSENT** — do not fabricate Helix history |

## Historical Grasshopper commits that once matched LIVE digests

Observed via `git show` + `sha256sum` in `/workspace/Grasshopper-full` (evidence of prior tip content; **not** a claim that live host blobs are present in the current tip or in Helix):

| Digest | Grasshopper commit that contained matching bytes |
| --- | --- |
| `ee0a9898…` (omni LIVE) | `709a107c52cf055e59d7e4038dac1562fe277ae5` |
| `6c6346ae…` (executor LIVE) | `c1d428a29f999fd5b97087c1789feb6a1ba012bf` |

## Companion overlay hashes (Grasshopper tip evidence; not LIVE-close criteria)

Computed 2026-09-27 on tip files (not asserted as live-host byte identity):

| Path | SHA-256 |
| --- | --- |
| `reference/production/deployed/helix-gateway-launcher.sh` | `c18d3d5fba7c4550e86e47ca2bcb5d11d6a956daad66ba27c773ffd0803c6435` |
| `reference/production/deployed/helix-gateway.service` | `dbaeddcc9110e13ac4a5ed655f1fa703d77f7a39f20343b13c17308f3422638a` |
| `reference/production/deployed/omni-agent.service` | `a72aa781742523dd3c1ee3ae18b848953ad4fa22b8338e6759cbb53be81c33f3` |
| `reference/production/deployed/helix-gateway.service.d/20-agent-secret.conf` | `76d6385c54dc745bbf81e33e4ae842ab09c7182b3c4d7b094fda86d4e7206baf` |
| `reference/production/deployed/omni-agent.service.d/20-agent-secret.conf` | `76d6385c54dc745bbf81e33e4ae842ab09c7182b3c4d7b094fda86d4e7206baf` |
| `reference/production/deployed/agent-secret.mjs` | `d3230af23be2372af2e8f1e92d769f9e23c666d637d59a0c36f420436090fabf` |
| `reference/production/target/omni-agent.service` | `9a001d37b595b0b81fe792150b9b5329eedfbf5fa6d4dfe6df7342e25032e69c` |

Drop-ins contain **secret id references only** (`HELIX_AGENT_TOKEN_SECRET_ID=omnikali/production/agent-bridge-token`), not secret payloads.

## Gate language

- Closing **G1** requires byte-identical **LIVE** import into the explicit overlays path, SHA-pinned to the LIVE digests above.
- Grasshopper tip delta is **documented intentional local hardening**, not live, and does **not** close G1.
- `executor_lineage` remains **blocked**.
- `PRODUCTION_AGENT_BRIDGE_RECOVERY` / reconstruction docs that still imply tip ≡ live are **stale relative to this ledger**; recovery language must not be read as gate unblock.
- Never invent Helix git history to make host-only SHAs look like descendants.
