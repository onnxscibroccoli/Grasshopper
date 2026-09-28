# Agentic reference control plane

## Contract

After the MVP reproducibility gate, an authorized automation agent must be able to reproduce the reference control plane from the same canonical Git revision. Reproduction drives the public CLI, not an in-process test double and not a production adapter.

Run:

```bash
npm run verify:agentic-control-plane
```

The gate archives `HEAD`, bootstraps the deterministic local environment, and then proves:

- idempotent agent and resource registration
- exclusive lock acquisition, rejection of a second owner, and release
- one completed task addressed by a stable operation key, including a duplicate submit
- the completed task is still completed when a new process reads the durable state
- export then import into an empty state file preserves the structural fingerprint
- reconcile leaves that completed task completed
- a copy of the imported snapshot still orphans a stale running task and drops an expired lock

## PASS means

The reference control plane was reconstructed from a clean Git archive and its lifecycle was exercised through `bin/omnikali.mjs`. The report records the exact canonical commit.

## PASS does not mean

It does not reconstruct production. It does not close RDS retention, secret cutover, service lifecycle, worker deployment, Kali execution, or live authenticated acceptance. Those remain under `npm run verify:agentic-deploy-readiness` and the production reconstruction documents.

No production credentials are read. No live production mutation is performed. The executor kind must stay `deterministic`.

## Design rule

This gate grows the automation surface from MVP source reproduction to the reference control plane. It does not replace the validated production topology:

`authenticated client -> Helix gateway -> provider-neutral PostgreSQL -> worker -> Kali`
