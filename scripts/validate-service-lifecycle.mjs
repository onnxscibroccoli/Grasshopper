# Production service lifecycle contract

This contract defines the machine-readable boundary between Grasshopper deployment automation and the authoritative Helix gateway/worker service lifecycle.

It does not invent service names, commands, OS users, paths, ports, or infrastructure identifiers. Those values belong to the authorized deployment environment.

## Required lifecycle capabilities

A production deployment manifest must identify, for each service:

- stable service identity;
- service manager/runtime;
- start action;
- stop action;
- restart action;
- status/readiness action;
- startup dependency ordering;
- runtime configuration reference;
- execution identity;
- rollback/recovery authority.

The gateway and worker are separate lifecycle units.

## Gateway requirements

The gateway lifecycle must establish:

1. protected runtime configuration is available before startup;
2. database configuration is resolved through the authorized secret-management boundary;
3. the gateway process starts under its least-privilege execution identity;
4. worker initialization occurs during gateway startup;
5. service failure is observable through the lifecycle manager;
6. restart does not require copying browser authentication state;
7. readiness is not reported until the gateway and required worker initialization are usable.

## Worker requirements

The worker lifecycle must establish:

1. the worker starts under its least-privilege execution identity;
2. worker ownership is represented by durable task/lease state, not process-local authority;
3. termination does not erase durable task state;
4. replacement workers can reclaim expired ownership;
5. worker restart/replacement does not create a second authoritative owner for a live lease.

## Ordering

The deployment controller must apply lifecycle actions in this order unless the authoritative deployment manifest explicitly documents a compatible dependency:

source/environment
-> infrastructure
-> database initialization
-> protected runtime configuration
-> gateway/worker lifecycle
-> readiness
-> acceptance

Stopping or replacing a worker must preserve PostgreSQL task state.

## Manifest boundary

A future production manifest may supply values such as:

- service manager and service identifiers;
- exact start/stop/restart/status commands;
- execution identities;
- protected runtime configuration references;
- startup dependencies;
- readiness checks;
- rollback actions.

Those values must be recovered from the deployed production system or an authoritative deployment source. They must not be guessed from the local reference implementation.

## Security rules

The manifest must not contain:

- passwords;
- credential-bearing database URLs;
- access tokens;
- session cookies;
- private keys;
- browser authentication state;
- secret payloads.

Secret references are permitted. Secret values are not.

## Compatibility rule

Changing gateway/worker lifecycle behavior in a way that changes task ownership, lease recovery, authentication, or worker initialization is a validated-contract change.

Before such a change is deployed, document:

- existing verified behavior;
- reason for the change;
- compatibility impact;
- migration/recovery strategy;
- new acceptance evidence.

## Current status

The lifecycle contract is formalized.

Authoritative production lifecycle values remain external deployment inputs. No service unit, command, identity, or runtime path is claimed by this repository until recovered from production evidence.
