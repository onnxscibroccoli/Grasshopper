# Architecture Decision Record Set

This document indexes the authoritative decisions relevant to the next implementation project. Full ADRs remain in IcePanel.

## ADR #1 — Verified restore point

Status: accepted.

A verified restore point is required before large coordinated changes. This is the safety checkpoint for reversible operational work.

## ADR #2 — CloudFront 504 recovery

Status: draft.

The 2026-09-25 incident established that the public desktop door depends on the Kali origin being running. Recovery starts the expected origin, waits for EC2/SSM/service readiness, then probes localhost and the public endpoint before escalating.

This remains a draft operational ADR and should be accepted or superseded before final Grasshopper handoff.

## ADR #3 — Production database binding

Status: rejected.

The Neon-specific production binding was superseded after the connected Neon account was verified to contain no projects.

## ADR #4 — AWS-managed PostgreSQL

Status: accepted.

Production uses AWS-managed PostgreSQL with a provider-neutral application contract. The database is private, Multi-AZ, encrypted, backed up, deletion-protected, and uses an AWS-managed Secrets Manager master password. PostgreSQL advisory locks and fail-closed readiness remain part of the application contract.

## Decision discipline

Do not reopen an accepted decision unless new evidence materially contradicts it. Infrastructure/provider changes must preserve the provider-neutral application contract unless an explicit new ADR changes that boundary.
