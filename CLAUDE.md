# Claude context pack — Grasshopper

Hard limit: stay under the model context window. Do not ingest the whole repo.

## Always load

- `AGENTS.md`
- this file

## Load on demand only

| Task | Open |
| --- | --- |
| Control plane | `src/`, `lib/`, `reference/` matching the failing test |
| BIST | `schemas/`, `scripts/validate-bist-schema.mjs` |
| CI loop | `.github/workflows/agentic-development-loop.yml` |
| Ingress protection | `BASE_SYSTEM_PROTECTION.md`, issue #62 |
| OCI workstation | `scripts/oci-workstation-rebuild.sh` |

## Never auto-load

- every file under `docs/`
- `infra/` trees unless the issue names a file
- generated `node_modules/` or lockfiles created by `npm install`

## Default commands

```text
npm test
npm run bist
npm run verify:agentic-control-plane
```
