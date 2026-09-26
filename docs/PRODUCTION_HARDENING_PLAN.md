# Production hardening plan

The production acceptance contract remains frozen. These are controlled hardening changes against the recovered live baseline.

## 1. Database runtime privilege reduction

Observed live state:
- runtime role: `helix`
- non-superuser
- CREATE on `public`
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

## 2. Backup and recovery hardening

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

## 3. Release reproducibility

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
