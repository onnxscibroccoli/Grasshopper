# Agentic development loop

Grasshopper uses a bounded co-development loop rather than autonomous mutation of production.

## Loop

observe -> classify -> isolate -> repair -> test -> record -> continue

The deterministic verification layer runs first. The coding agent runs only after that gate passes and only from scheduled or explicitly dispatched runs.

## Agent authority

The coding agent may change repository code, tests, scripts, documentation, and workflow definitions. It creates a pull request and never merges to `main`.

It may not:

- deploy or mutate AWS production
- modify Helix, Kali, nginx, CloudFront, PostgreSQL, libvirt/QEMU, VNC/noVNC, or production ingress
- access production credentials
- weaken verification or bypass failures
- make destructive infrastructure changes

## CI contract

Every autonomous cycle must:

1. inspect the current source and CI evidence
2. identify one bounded improvement or first real failure
3. make the smallest coherent repair
4. test the repair
5. run the full test suite
6. preserve evidence in the pull request
7. stop when no justified change exists

## Authentication

The intended agent authentication path is GitHub Actions OIDC to the agent provider. No long-lived provider credential is stored in the repository workflow.

The autonomous job is intentionally inert until the required federation variables are configured.

## Why this is bounded

The agent can write code, tests, and additional automation, but all resulting changes become reviewable GitHub pull requests. Deterministic CI remains the acceptance gate, and production deployment remains a separate controlled system.
