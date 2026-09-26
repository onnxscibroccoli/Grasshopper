# Authoritative production source recovery

This document records the source-recovery boundary discovered during implementation.

## Canonical application repository

The deployed application source repository identified by the historical Grasshopper readiness evidence is:

- onnxscibroccoli/helix

The production fix commit recorded by the acceptance seed is:

- 38903b021cca75189a99e1ed88b508bae577f048

That commit initializes the task worker during gateway startup and is part of the accepted production history.

## Current repository evidence

The current default branch of Helix contains production gateway and hypervisor implementation, PostgreSQL migration tooling, application migrations, production architecture documentation, and an AWS EC2 rebuild substrate.

However, the current default-branch database abstraction still contains historical Neon/PGlite terminology and therefore must not be treated as the authoritative description of the now-verified production PostgreSQL binding.

The current repository also does not expose a task schema that can safely be asserted as the complete production schema for the accepted task/lease/idempotency path.

## Consequence

Grasshopper must not copy the current Helix migration set into a new production migration plan merely because migration files exist.

The authoritative production schema for tasks, worker ownership, leases, operation identity, cancellation, and recovery must be recovered from the deployed application revision and/or the live PostgreSQL database through an authorized, non-secret inspection path.

## Source/runtime reconciliation

Before production reconstruction becomes reproducible, deployment automation must establish:

1. exact deployed Helix application revision;
2. exact gateway and worker entrypoints;
3. service lifecycle definitions;
4. runtime configuration references;
5. authoritative PostgreSQL schema and applied migration state;
6. compatibility between deployed source and repository source.

A dirty or divergent production checkout is not sufficient evidence of source identity.

## Security boundary

Source recovery must never export passwords, credential-bearing database URLs, access tokens, session cookies, private keys, browser authentication state, or secret payloads.

Schema metadata, migration names, service identities, commit identifiers, and non-secret configuration references may be recorded when authorized.

## Status

Source repository identity is established.

Production revision, service lifecycle values, and authoritative task/lease schema remain reconciliation inputs.

No new production schema is invented by Grasshopper.