# OmniKali agent secret contract

This is the clean-host runtime contract for the recovered agent bridge. It does not authorize a production mutation.

## Secret reference

Deployment supplies `OMNIKALI_AGENT_SECRET_ID` as a secret-manager reference.
The secret payload itself never appears in source control, deployment inputs, logs, or prompts.

## Secret payload

The Secrets Manager `SecretString` must be JSON containing exactly the runtime credential field required by the bridge:

```json
{"AGENT_TOKEN":"<secret>"}
```

The placeholder above is documentation only. No real value belongs in repository artifacts.

## Runtime resolution

At service startup the launcher:

1. requires `OMNIKALI_AGENT_SECRET_ID`;
2. calls AWS Secrets Manager using the instance execution identity;
3. parses `SecretString` without logging it;
4. exports `AGENT_TOKEN` only in the child process environment;
5. removes the fetched JSON from the launcher shell environment;
6. execs the canonical `src/production/omni-agent.mjs` artifact.

Failure to resolve or parse the secret is a startup failure. The launcher must fail closed.

## IAM boundary

The execution identity needs only the permission required to read this specific secret and the KMS decrypt permission required by that secret when customer-managed encryption is used.

The bridge does not need permission to list secrets, create secrets, rotate secrets, or modify IAM.

## Acceptance requirement

After migration from the current protected host environment file:

- local bridge health must pass;
- authenticated execution must pass;
- gateway task execution must pass;
- duplicate-side-effect fencing must pass;
- worker termination and stale-lease recovery must pass;
- gateway restart must pass;
- database failure and network interruption must pass;
- rollback must restore the prior working runtime without losing durable ownership.

The migration is not complete until the full acceptance evidence exists.