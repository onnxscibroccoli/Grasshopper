# Secret-reference contract

Runtime secrets are references, not source-controlled values.

## Required shape

A deployment may declare a secret reference with:

- provider: the authorized secret provider
- name: stable secret identifier
- version or rotation policy, when supported
- consumer: the exact service that reads it
- permissions: the narrow identity permitted to read it

Secret values, tokens, passwords, private keys, session cookies, and connection strings containing credentials are forbidden in manifests, tests, fixtures, commits, and logs.

## Verification

A reconstruction test may assert that a reference exists and that the consumer identity is authorized. It must not print or compare the secret value.

A synthetic fixture may use a fake secret reference such as test/omnikali/database, but must never resemble a production credential.

## Production gate

The production secret cutover remains OPEN until an authorized dated acceptance proves:

1. the reference resolves;
2. the intended service can consume it;
3. the secret is not exposed in process output or logs;
4. rotation/revocation behavior is documented.

This contract does not authorize a production secret change.
