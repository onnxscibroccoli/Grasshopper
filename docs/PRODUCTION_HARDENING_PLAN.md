# Production hardening plan

The production acceptance contract remains frozen. These are controlled hardening changes against the recovered live baseline.

## 1. Database runtime privilege reduction

Observed live state:
- runtime role: helix
- non-superuser
- CREATE on public
- CREATEROLE
- CREATEDB
- broad table privileges

Required implementation:
1. inventory every SQL operation used by gateway, worker, recovery, and migration tooling;
2. separate migration authority from runtime authority where compatible;
3. create the narrowest runtime grants required by the observed application;
4. apply in a non-production reconstruction first;
5. run readiness, normal execution, stale-lease recovery, duplicate fencing, restart, DB failure, and network interruption acceptance;
6. only then schedule production privilege reduction.

No direct production privilege change is authorized by this document.

## 2. Agent bridge credential hardening

Observed live state:
- the production bridge is an exact recovered artifact;
- its source-authoring event is resolved;
- the original authoring path placed the bearer credential in the host runtime environment and exposed it in remote-tool journal metadata.

Required implementation:
1. preserve the exact bridge artifact and fingerprint;
2. provision a secret-manager reference for the bridge credential;
3. inject the credential at runtime without placing the secret payload in source or deployment inputs;
4. rotate the existing bridge credential;
5. validate local and authenticated remote bridge health;
6. run normal execution and the complete recovery/failure acceptance suite;
7. retain rollback evidence.

The current artifact is evidence, not permission to mutate production. The bridge implementation itself must remain the execution primitive while credential handling is hardened.

## 3. Executor semantics hardening

The recovered bridge currently provides command execution, but not durable executor-side idempotency or cancellation fencing.

Required implementation:
1. retain durable operation identity in the control plane;
2. classify operations by side-effect semantics;
3. propagate operation identity to the executor where the command type supports it;
4. acknowledge cancellation only at a defined executor boundary;
5. keep interrupted external operations indeterminate until reconciled;
6. prevent control-plane completion from implying stronger external guarantees than the executor provides;
7. acceptance-test duplicate fencing, cancellation, interruption, and reconciliation.

See docs/PRODUCTION_AGENT_BRIDGE_HARDENING.md.

## 4. Backup and recovery hardening

Observed live RDS state:
- automated backup retention: 1 day
- Multi-AZ: enabled
- encryption: enabled
- deletion protection: enabled

The earlier production target called for a longer backup/PITR window. The live setting is therefore a configuration discrepancy that must be resolved through controlled infrastructure change, not assumed to be correct.

Required implementation:
1. define the desired retention/recovery objective explicitly;
2. encode it in reproducible infrastructure;
3. validate the resulting RDS configuration;
4. document restore/recovery procedure;
5. prove that durable task ownership survives service/database recovery.

## 5. Release reproducibility

The deployed Helix checkout is dirty. The observed migration artifacts match that checkout, but the checkout itself is not a release artifact.

Required implementation:
- identify the exact clean source lineage;
- capture production-local runtime overlays separately;
- produce a deterministic deployment manifest;
- reconstruct on a clean host;
- execute readiness and acceptance;
- retain the resulting evidence.

## Change-control rule

No hardening change may weaken:
- authenticated gateway access;
- PostgreSQL durability;
- PENDING -> RUNNING -> COMPLETED | FAILED;
- durable lease ownership;
- stale lease reclamation;
- replacement-worker fencing;
- executor credential/session boundaries.

Any contract change requires compatibility impact, migration/recovery strategy, and new acceptance evidence.
