# System Architecture

## System identity

OmniKali is a distributed authenticated control plane for durable task orchestration across local, remote, VM, desktop/GUI, and cloud execution environments. Grasshopper defines the provider-neutral orchestration model; the implementation project will bind that model to production infrastructure.

## Control-plane model

The control plane owns:
- authorized execution identity;
- declared resources and desired state;
- durable task intent and lifecycle;
- exclusive lock ownership and expiry;
- append-only lifecycle evidence;
- reconciliation of stale work.

Execution environments are adapters. Providers must not become hidden domain sources of truth.

## Core domain

- Agent: authorized execution identity plus environment binding.
- Resource: declared capability with desired and observed state.
- Task: durable intent, execution handle, and result.
- Lock: exclusive coordination primitive with owner and expiry.
- Event: append-only lifecycle evidence.
- Environment: adapter that starts, stops, and observes execution.

## Adapter progression

1. Deterministic/local adapter for non-privileged validation.
2. Remote host adapter behind an explicit capability boundary.
3. QEMU/libvirt VM lifecycle adapter.
4. Browser/desktop observation and interaction adapter.
5. AWS/cloud resource adapters.

The implementation may add adapters only when their boundary is explicit and tested.

## Production topology evidence

- Public entry path includes a stable public door and an authenticated Helix gateway.
- Gateway runs on EC2 and supervises the remote desktop/control-plane services.
- Kali workstation runtime uses QEMU/libvirt, with noVNC/RFB and guest supervision.
- Production control-plane durable state is intended to live in private AWS-managed PostgreSQL.
- The database must remain outside the EC2 compute node.
- DB ingress is restricted to the authorized application security group.
- Production secrets remain outside source and documentation.

## Failure model

Critical components must answer:
1. How do we know it is alive?
2. How do we know it is healthy?
3. How do we recover it?
4. How do we verify recovery?

Known failure cases include stopped EC2/Kali origins, stale workers, expired locks, process restart, endpoint/proxy failure, database configuration drift, and source/runtime drift.

## Source/live separation

Track independently:
- repository commit and branch;
- deployed artifact;
- service-manager state;
- running process;
- network endpoint/proxy;
- external public-door state;
- database and secret/configuration state.

A successful source change is not deployment evidence, and a reachable endpoint is not application-health evidence.
