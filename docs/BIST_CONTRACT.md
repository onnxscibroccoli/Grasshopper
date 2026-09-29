# BIST contract (C0)

Schema: `omnikali-bist/v1`

Statuses: `PASS`, `FAIL`, `NOT_PROVEN`, `NOT_APPLICABLE`.

## Rules

- Local artifact and command checks may PASS or FAIL.
- Production database, worker recovery, executor side-effects, and authenticated desktop remain `NOT_PROVEN` unless a later authorized live acceptance run is added. A historical acceptance ID may be cited in `detail` only.
- `production.gateway` stays `NOT_PROVEN` unless `OMNIKALI_BIST_PUBLIC=1` or `--public` enables a GET of `/health`. No cookies. No authenticated task-create POST.
- Kubernetes public ingress is `NOT_APPLICABLE` while CloudFront → nginx → Helix remains the proven edge.
- `--skip-local` avoids recursive `npm test` (required for CI and unit tests).
- `--allow-dirty` marks `source.clean` `NOT_APPLICABLE` so an agent working tree is not confused with a production contract failure.

```bash
npm run bist -- --skip-local
OMNIKALI_BIST_PUBLIC=1 npm run bist -- --skip-local --allow-dirty
```
