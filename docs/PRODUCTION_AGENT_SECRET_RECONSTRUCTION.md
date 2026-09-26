# Production agent secret reconstruction gate

Status: repository hardening stage, no production mutation.

## Established facts

- The recovered production bridge is canonicalized at `src/production/omni-agent.mjs`.
- The runtime secret contract uses a Secrets Manager reference, not a credential value.
- The target service starts the bridge through `scripts/start-omni-agent-from-secret.sh`.
- The launcher fails closed when the secret reference is absent or the secret cannot be parsed.
- The launcher only exports `AGENT_TOKEN` to the child bridge process.
- The repository now contains `scripts/test-agent-secret-launcher.sh`, which substitutes test-only command shims and verifies the launcher contract without contacting AWS or containing a real credential.

## IAM boundary

The intended production permission is resource-scoped read access to the single agent secret, plus the KMS decrypt permission required by that secret when customer-managed encryption is used.

The bridge does not require permission to list, create, rotate, or modify secrets, and it does not require IAM administration.

The current production instance role was tested for policy enumeration and returned `iam:ListRolePolicies` access denied. Therefore the repository must not infer the live role policy document from the instance itself.

The remaining infrastructure gate is an authorized IAM-side inventory of `HelixKaliDesktopRole`, followed by a minimal policy addition for the dedicated agent secret. No production credential rotation is implied by this document.

## Reconstruction sequence

1. Provision a dedicated Secrets Manager secret through the authorized infrastructure path.
2. Grant only the instance role permission to read that exact secret and decrypt its KMS key when required.
3. Install the target runtime environment containing the secret reference, not the secret value.
4. Start the canonical bridge through the launcher.
5. Verify health and authenticated command execution.
6. Run the full production acceptance suite, including duplicate-side-effect fencing, worker interruption/recovery, gateway restart, database failure, and network interruption.
7. Rotate/revoke the legacy protected host credential only after the new path passes acceptance.
8. Retain rollback instructions until post-migration acceptance is complete.

## Compatibility constraint

This work does not replace the QEMU guest-agent execution boundary, the gateway, PostgreSQL, task lifecycle, lease recovery, or worker ownership model.

The launcher is a credential-resolution boundary around the existing bridge. The bridge remains the recovered production artifact until executor hardening is separately accepted.

## Verification

The normal reference verification now invokes the launcher reconstruction harness. The harness uses only a test token and asserts that the token is not emitted by the launcher test output.

This is reconstruction evidence only. It is not production acceptance evidence.
