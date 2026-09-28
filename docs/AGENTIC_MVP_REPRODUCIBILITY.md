# Agentic MVP reproducibility

## Contract

An authorized automation agent must be able to take a committed canonical Git revision, create a clean source snapshot, bootstrap the reference control plane, run the complete test suite, validate the reference state, and verify the resulting durable state without undocumented human steps, production credentials, a live Helix host, PostgreSQL/RDS access, synthetic production sessions, or operator-local state.

Run:

```bash
npm run verify:agentic-reproducibility
```

## PASS means

The exact `HEAD` revision is archived with Git, reconstructed in a new temporary directory, checked for carried state/private-key material, bootstrapped, tested, reference-verified, and checked for the expected durable agent/resource state. The report records the exact canonical commit.

This is the MVP reproducibility gate. It is intentionally independent of production-only blockers such as RDS retention, live secret cutover, production source lineage, and live acceptance.

## PASS does not mean

It does not claim production has been reconstructed or that production readiness gates are closed. The validated production topology remains:

`authenticated client -> Helix gateway -> provider-neutral PostgreSQL -> worker -> Kali`

Production readiness remains fail-closed under `npm run verify:agentic-deploy-readiness`.

## Design rule

Grow the automation working surface outward from the proven core. Do not substitute or weaken the validated production architecture merely to satisfy this local reproducibility MVP.

The next gate is reference control-plane reproduction: `npm run verify:agentic-control-plane`. See [AGENTIC_REFERENCE_CONTROL_PLANE.md](./AGENTIC_REFERENCE_CONTROL_PLANE.md). It is still not a production reconstruction claim.
