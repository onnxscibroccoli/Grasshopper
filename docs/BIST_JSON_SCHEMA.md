# BIST JSON Schema

**Schema id:** `omnikali-bist/v1`  
**Owner:** `onnxscibroccoli/Grasshopper`  
**Emitter:** `scripts/bist.mjs` (`npm run bist`)  
**Files:**

- `schemas/omnikali-bist-v1.schema.json` — report emitted by BIST
- `schemas/omnikali-bist-evidence-v1.schema.json` — optional production evidence input
- `scripts/validate-bist-schema.mjs` — dependency-free validator

## Status vocabulary

| Status | Meaning |
|---|---|
| `PASS` | Contract proven by this run or by cited acceptance evidence |
| `FAIL` | Contract exercised and broken |
| `NOT_PROVEN` | Contract not exercised or evidence missing |
| `NOT_APPLICABLE` | Contract is out of scope for the current production path |

A component must not report `PASS` only because a process, pod, or HTTP listener is alive.

## Overall rollup

| `overall` | Rule |
|---|---|
| `FAIL` | Any blocking check is `FAIL` |
| `PASS` | Every blocking check is `PASS` and none are `NOT_PROVEN` |
| `PASS_WITH_NOT_PROVEN` | No blocking `FAIL`, but at least one `NOT_PROVEN` remains |

The current emitter uses `FAIL` or `PASS_WITH_NOT_PROVEN`. `PASS` is reserved for a fully proven live suite.

## Commands

```bash
npm run bist
OMNIKALI_BIST_OUTPUT=evidence/bist-report.json npm run bist
node scripts/validate-bist-schema.mjs report evidence/bist-report.json
node scripts/validate-bist-schema.mjs evidence schemas/examples/bist-evidence.valid.json
npm run test:bist-schema
OMNIKALI_BIST_SKIP_LOCAL=1 npm run bist
```

Local checks are opt-out for direct `runBist()` calls by default, but callers can set `includeLocal=false` or `OMNIKALI_BIST_SKIP_LOCAL=1` to skip them. When skipped, `local.unit-tests` and `local.reference-verification` are `NOT_APPLICABLE` and non-blocking. This prevents BIST contract tests from recursively launching `npm test`.

Public health probe stays opt-in (`OMNIKALI_BIST_PUBLIC=1`) and is GET `/health` only. BIST never authenticates or creates production tasks.

## Five-phase mapping

The schema allows optional `phase` on each check. Current `scripts/bist.mjs` does not yet set `phase`. When added, use:

1. `auth`
2. `provisioning`
3. `connectivity`
4. `interactive`
5. `recreation`

Until those live phases emit `PASS` with an acceptance ID, production desktop remains `NOT_PROVEN`.
