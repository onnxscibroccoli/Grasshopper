# OmniKali Transcendental Architecture Workstream

**Timestamp:** 2026-09-29 EDT  
**Repository:** `onnxscibroccoli/Grasshopper`  
**Status:** Strategic architecture backlog grounded in verified production evidence

## Purpose

This document converts the current paradigm-shift ideas into implementation boundaries without treating unproven capabilities as production facts.

The governing sequence remains:

**validated production core -> hardening -> reproducibility -> autonomous verification -> controlled generalization**

## 1. Terminal-agnostic agentic compute

### Target

An authorized agent should be able to request an execution environment through a stable control-plane contract without knowing whether the terminal is a browser, workstation shell, Android terminal, router shell, CI runner, or another constrained interface.

### Boundary

The terminal is an interface, not the execution substrate.

The control plane owns:
- authentication and authorization;
- resource declarations;
- task creation;
- lifecycle;
- leases;
- cancellation;
- recovery;
- result and artifact references.

The execution adapter owns the environment-specific details.

### Acceptance gate

The same signed/authorized task contract must produce equivalent lifecycle semantics across at least two materially different terminal clients without changing the production task model.

## 2. Agentic autonomous reproducibility

### Target

A clean environment should be reconstructable from canonical source, declarative infrastructure, migrations, configuration contracts, and documented prerequisites with no undocumented human step.

### Current evidence

Grasshopper already has a reference control plane and explicit production evidence. Clean-host production reconstruction remains an open gate.

### Required additions

- deterministic bootstrap manifest;
- environment capability probe;
- infrastructure prerequisite manifest;
- migration ordering and verification;
- secret-reference contracts without secret values;
- health/readiness gates;
- rollback procedure;
- machine-readable evidence bundle;
- final acceptance report.

A clean reconstruction must never require copying production credentials or synthetic session state.

## 3. Autonomous self-test / BIST

BIST becomes a first-class architecture rule.

Every major boundary should expose a safe, bounded self-test that proves its contract without destructive mutation.

Examples:
- gateway health and dependency checks;
- database schema/version checks;
- worker claim/lease checks;
- executor capability checks;
- guest-agent connectivity;
- remote-display reachability;
- Kubernetes isolation checks;
- ingress path checks.

A BIST result must distinguish:
**PASS, FAIL, NOT_PROVEN, and NOT_APPLICABLE**.

A component must not report PASS merely because its process is alive.

## 4. Autonomous self-repair

Self-repair is permitted only inside an explicit policy envelope.

The repair engine must:
1. identify the failed contract;
2. capture evidence;
3. create a restore point when possible;
4. select an approved repair action;
5. apply the smallest repair;
6. rerun the relevant BIST;
7. run regression acceptance;
8. record the repair and evidence;
9. roll back when the acceptance gate fails.

Production architecture changes remain human-reviewable unless a separately authorized policy explicitly permits the repair class.

## 5. Vulnerability research / security arbitrage

Security research should be isolated from the production control plane.

The platform may provide disposable, permission-bounded fuzzing and validation workers for authorized targets. Findings must be tracked with provenance and responsible-disclosure metadata.

No production credential, tenant data, or uncontrolled third-party target belongs in a fuzzing worker.

## 6. Semantic intent layer

Lambda-calculus terminology is treated as an architectural research direction rather than a claim that the current system already implements a formal semantic compiler.

The practical near-term contract is:

**intent -> typed capability request -> authorization/policy -> executable plan -> task graph -> executor -> evidence**

Each transformation should preserve an inspectable representation so an agent can explain which intent produced which operation.

Future formal semantics can be introduced behind this stable interface without rewriting the validated execution core.

## 7. Autonomous infrastructure control plane

The long-term OmniKali model remains three layers:

1. **Remote AI computer**
2. **Agent execution platform**
3. **Agent infrastructure/control plane**

Kali is one execution target, not the product boundary.

Future targets can include Linux, Windows, mobile/edge devices, and other authorized compute resources through adapters.

## 8. Multi-cloud portability

Portability is a property to prove, not an architecture slogan.

Provider-specific infrastructure may implement the control plane, but the application contract should remain provider-neutral.

The portability gate is:

**same control-plane contract + different infrastructure adapter + successful acceptance suite**

AWS remains the current validated production provider. Kubernetes, GKE, EKS, local infrastructure, and other providers remain controlled portability lines until independently accepted.

## 9. Multi-agent orchestration

The primary agent may delegate bounded work to sub-agents.

Each sub-agent must have:
- explicit scope;
- repository/resource boundary;
- allowed tools;
- acceptance criteria;
- timeout;
- evidence output;
- rollback expectations.

Parallel work is useful only when ownership boundaries prevent conflicting mutations.

## 10. Persistent identity and ingress

Identity and ingress remain separate contracts.

The production baseline must not be displaced merely to prove a new ingress model.

The Kubernetes FRP/self-hosted ingress line must remain isolated until it passes the complete browser-to-intended-desktop acceptance boundary.

OIDC, short-lived credentials, RBAC, and secret-manager references are the preferred direction for new infrastructure where compatible with the validated contracts.

## 11. Persistent context and memory

A durable context layer should expose searchable project state without making the LLM's conversational context itself the source of truth.

Canonical state belongs in versioned artifacts, databases, evidence records, and explicit knowledge-graph relationships.

Conversation indexing is an accelerator, not the authority.

## 12. Production readiness gates

The following gates become the implementation roadmap:

### Gate A - Proven core
Helix -> PostgreSQL -> worker -> libvirt/QEMU -> Kali remains healthy and recoverable.

### Gate B - Reproducible reconstruction
A clean environment can be built from source and declared prerequisites without undocumented steps.

### Gate C - BIST
Every critical boundary has machine-readable self-tests and evidence classification.

### Gate D - Self-repair
Approved failure classes can be detected, repaired, re-tested, and rolled back automatically.

### Gate E - Terminal independence
At least two materially different terminal clients drive the same control-plane contract.

### Gate F - Execution generalization
A second execution substrate is accepted without changing the proven task lifecycle contract.

### Gate G - Portability
A second infrastructure provider or isolated local substrate passes the same acceptance contract.

### Gate H - Autonomous operations
Bounded multi-agent orchestration can diagnose, change, verify, document, and recover from failures with durable evidence.

## Non-negotiable rule

Do not turn a strategic concept into a production claim until an acceptance test proves it.

The architecture is intentionally built outward from the validated Helix/Kali core rather than replacing that core with the newest prototype.
