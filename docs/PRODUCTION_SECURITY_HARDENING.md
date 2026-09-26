# Production security hardening findings

Date: 2026-09-26

## Finding: database runtime role is broader than intended

The live PostgreSQL runtime identity is the non-superuser role `helix`.

Observed privileges include:

- CREATE on the public schema
- CREATEROLE
- CREATEDB
- broad table privileges including SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, and TRIGGER on the control-plane tables inspected

This exceeds the intended least-privilege boundary.

## Why this is not changed immediately

The production acceptance gate has already validated the current gateway/database/worker behavior. Removing privileges without compatibility evidence could break migrations, task persistence, recovery, or startup.

Therefore this is a controlled hardening item, not an emergency production edit.

## Required remediation evidence

Before reducing privileges:

1. identify every production SQL operation performed by gateway, migration runner, worker, and recovery paths;
2. define separate migration authority from runtime application authority if the deployed contract permits it;
3. verify required schema/table/sequence/function privileges;
4. test startup and readiness;
5. test normal task execution;
6. test lease expiry and replacement-worker recovery;
7. test duplicate/idempotency fencing;
8. test gateway restart;
9. test database connectivity failure and network interruption;
10. capture rollback evidence that preserves durable task ownership.

No plaintext credentials, secret payloads, session cookies, or database passwords belong in the remediation artifacts.

## Current disposition

Open hardening item.

The finding does not invalidate the already-passed production acceptance evidence. It defines the next security-hardening change and its required acceptance evidence.
