# Grasshopper production-readiness checklist

| Check | Status |
|---|---|
| Reference control plane local tests | DOCUMENTED — `npm test`, `node bin/omnikali.mjs status` |
| Live path vs prototype documented | PASS — `docs/LIVE_PATHS.md` |
| Protect ports 80/443 | OPEN — issue #62 must stay visible |
| RDS backup retention 14d | OPEN — issues #13 / #26 |
| Fresh production acceptance IDs | OPEN — historical only |
| Secrets in git | FORBIDDEN |
