# Production source lineage reconciliation

Status: **reconciliation required before production reconstruction**.

## Authoritative references

- Application repository: `onnxscibroccoli/helix`
- Accepted production-fix revision: `38903b021cca75189a99e1ed88b508bae577f048`
- Observed deployed checkout: `46ba4b71158a74db5ede97e300099370792ecff8`
- Deployed checkout state: dirty

The accepted revision remains the source-of-truth reference for validated production behavior. The observed deployed checkout is runtime evidence, not a clean release artifact.

## Migration reconciliation

The accepted Helix revision contains the authoritative numbered migration chain:

1. `0001_auth.sql`
2. `0002_workspaces.sql`
3. `0003_stream.sql`
4. `0004_omnikali_tasks.sql`

Those files were recovered into `reference/production/helix-accepted/migrations/` as evidence copies. They are not a replacement for the Helix source repository.

The live production migration ledger contains the same four filenames in the same order. The live migration SHA-256 evidence in `reference/production/observed-db-baseline.json` differs from the clean accepted-source artifacts. This means the deployed migration artifacts are not proven byte-for-byte identical to the accepted revision.

That discrepancy is evidence of source/runtime drift and must be resolved before a clean production release is declared reproducible.

## Required next gate

An authorized automation workflow must establish:

1. the exact clean Helix revision corresponding to the deployed runtime artifacts;
2. the complete set of production-local modifications and runtime overlays;
3. which changes are intended release content versus host-local configuration;
4. a clean build/deployment artifact with deterministic hashes;
5. readiness and full acceptance on a reconstruction target;
6. rollback/recovery evidence from that clean artifact.

Until those gates pass, production mutation remains disabled by the reconstruction manifest.

## Safety

This document contains no passwords, credential-bearing URLs, tokens, cookies, private keys, or secret values. Evidence copies must never be promoted into a second source of truth.
