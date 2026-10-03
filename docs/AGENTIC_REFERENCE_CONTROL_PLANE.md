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

## Instance model

The reference control plane treats a user workspace as an **instance** with an explicit lifecycle and retention mode.

- `persistent`: stop and resume without destroying the instance identity or durable state.
- `ephemeral`: create for a bounded workflow and destroy when the workflow is finished.
- Each instance has a stable `instanceId`, a human-readable name, a kind, desired configuration, and lifecycle state.
- `activeInstanceId` is the control-plane selection used by a client to switch the visible workspace.
- Tasks may target an instance explicitly. A task cannot target a missing, destroyed, or non-ready instance.
- Multiple instances may coexist for one user. They are not serialized behind the active UI selection.
- Instance lifecycle in this reference implementation is stateful control-plane intent. Provider-specific provisioning, desktop frame transport, and hypervisor operations remain separate adapters and are not claimed by this gate.

This makes the intended client flow explicit:

`create instance -> wait ready -> switch -> run tasks -> switch between instances -> stop/resume persistent OR destroy ephemeral`

The same instance contract can later map to a cloud VM, Android emulator, containerized browser, KVM guest, edge emulator, or another provider without changing the user-facing selection model.
