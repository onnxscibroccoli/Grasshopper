# Production security hardening findings

Date: 2026-09-26

## Finding: database runtime role is broader than intended

The live PostgreSQL runtime identity is the non-superuser role helix.

Observed privileges include:

- CREATE on the public schema
- CREATEROLE
- CREATEDB
- broad table privileges including SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, and TRIGGER on the control-plane tables inspected

This exceeds the intended least-privilege boundary.

## Finding: original agent bridge credential handling was not reproducible-safe

The recovered production agent bridge was authored directly on the production host. The authoring journal shows that its bearer credential was placed directly into a protected host environment file and was also present in remote-tool journal metadata during the original setup.

The exact credential value is intentionally not retained in Grasshopper.

The reproducible deployment contract now requires:

- OMNIKALI_AGENT_SECRET_ID as a secret-manager reference;
- no AGENT_TOKEN deployment input;
- runtime secret resolution outside source control;
- complete acceptance after credential rotation.

The artifact validator also rejects known credential-bearing input names and preserves the exact recovered bridge bytes without copying the credential value.

## Why these are not changed immediately

The production acceptance gate has already validated the current gateway/database/worker behavior. Removing privileges or changing credential injection without compatibility evidence could break migrations, task persistence, recovery, startup, or the execution path.

Therefore these are controlled hardening items, not ad hoc production edits.

## Required remediation evidence

Before reducing database privileges or changing bridge credential injection:

1. identify every production SQL operation performed by gateway, migration runner, worker, and recovery paths;
2. define separate migration authority from runtime application authority if the deployed contract permits it;
3. verify required schema/table/sequence/function privileges;
4. establish secret-manager-backed bridge runtime injection;
5. rotate the bridge credential;
6. test startup and readiness;
7. test normal task execution;
8. test lease expiry and replacement-worker recovery;
9. test duplicate/idempotency fencing;
10. test gateway restart;
11. test database connectivity failure and network interruption;
12. capture rollback evidence that preserves durable task ownership.

No plaintext credentials, secret payloads, session cookies, or database passwords belong in the remediation artifacts.

## Additional infrastructure observation

The live RDS instance currently reports 1 day of automated backup retention. If the production recovery objective requires the previously intended longer retention/PITR window, this is an infrastructure hardening change that must be implemented and acceptance-tested rather than assumed from infrastructure code.

## Current disposition

Open hardening items.

The findings do not invalidate the already-passed production acceptance evidence. They define the next controlled security-hardening changes and their required acceptance evidence.
