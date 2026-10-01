# Grasshopper Security Phase Model

**Status:** Proposed architecture contract
**Scope:** Grasshopper Phase 2 / OmniKali development, staging, and production boundaries
**Principle:** Optimize early iteration without allowing development permissiveness to become an accidental production security policy.

## 1. Design goal

Grasshopper needs two properties that normally conflict:
1. Very fast experimentation while the architecture is still being discovered.
2. A deterministic path to a fail-closed production system.

The solution is a security-phase model. Security posture is explicit, versioned, testable, and promoted through gates. A permissive development environment is an intentional sandbox, never an implicit production default.

The phases are:
- DEV_SANDBOX: permissive, disposable, isolated, fast iteration.
- STAGING: authenticated, bounded, production-like, destructive actions gated.
- PROD_CANDIDATE: fail-closed by default, all trust boundaries explicit, launch evidence required.
- PROD: fail-closed, least privilege, durable audit/recovery, no implicit trust.

No phase may silently downgrade another phase.

## 2. Immutable production boundary

The validated production path remains:

CloudFront -> nginx -> Helix :8092 -> libvirt/QEMU -> helix-omnikali -> Kali

This architecture is protected while Grasshopper evolves.

Development experiments must not:
- replace production port 80/443 ownership;
- install a competing production ingress;
- replace production RDS;
- alter production authentication;
- expose the OpenClaw Gateway publicly;
- use production credentials as development fixtures;
- claim live acceptance from local tests.

The existing production desktop/database/worker/executor boundaries remain evidence-gated. If evidence is missing, the BIST state is NOT_PROVEN, not an inferred pass.

## 3. Phase policy

| Control | DEV_SANDBOX | STAGING | PROD_CANDIDATE | PROD |
|---|---|---|---|---|
| Network reachability | permissive inside isolated sandbox | allowlisted | allowlisted | allowlisted |
| Gateway bind | loopback or private sandbox network | loopback/private | loopback/private | loopback/private |
| Authentication | disposable test identity permitted | required | required | required |
| Authorization | broad test scopes permitted | bounded scopes | least privilege | least privilege |
| Secrets | synthetic/disposable only | isolated test secrets | production-like secret handling | production secrets only |
| Tool execution | broad test tools | allowlist | allowlist + approvals | allowlist + approvals |
| Destructive actions | permitted on disposable resources | gated | gated + evidence | explicit approval/policy gate |
| Data | synthetic | sanitized | production-shaped, non-sensitive | production data |
| Persistence | optional | required for tested services | required | required |
| Backups | optional | required for stateful services | verified restore | verified restore |
| Audit | development logs | structured | immutable/retained | immutable/retained |
| Failure behavior | diagnostics may be permissive | fail closed at trust boundary | fail closed | fail closed |
| Acceptance | unit/integration | authenticated live tests | launch gate | continuous verification |

## 4. Security architecture

Use four explicit planes.

### Plane A: Human/operator plane

Android/browser -> authenticated transport -> operator client -> OpenClaw/Helix APIs.

Development may use a broad disposable operator identity.

Staging and production require:
- authenticated identity;
- device/client identity;
- explicit operator scopes;
- approval for privileged execution;
- no bearer token copied into application configuration when pairing can mint a device credential.

The current OCI OpenClaw Gateway remains loopback-only. SSH forwarding or an identity-aware private transport is the intended development operator path. Public port 18789 is prohibited.

### Plane B: Control plane

The control plane owns durable state, leases, task lifecycle, recovery, authorization, audit, and acceptance evidence.

It must never infer authorization from network reachability.

### Plane C: Execution plane

Workers and guest agents execute only leased, authorized work.

Required invariants:
- every execution has an owner;
- every execution has a lease/fence;
- stale workers cannot complete a newer generation;
- human input has priority;
- privileged execution is explicit;
- recovery is deterministic.

### Plane D: Guest/workstation plane

Kali desktop, browser, filesystem, and local agents are treated as a separate trust boundary.

Persistence is valuable, but persistence does not imply trust. A restored workstation must re-enter through the control-plane authorization path.

## 5. Development permissiveness contract

DEV_SANDBOX may deliberately enable:
- broad operator scopes;
- disposable credentials;
- test-only guest execution;
- relaxed network policy inside an isolated VCN/network;
- automatic service startup;
- experimental agents and models;
- fast-reset infrastructure.

It may not enable:
- access to production credentials;
- access to production databases;
- modification of the validated production ingress;
- unrestricted Internet exposure of control-plane administration;
- reuse of development identities in production.

Every permissive control must have:
1. a phase identifier;
2. a documented reason;
3. a bounded resource scope;
4. an expiry/removal condition;
5. a verifier.

## 6. Promotion gates

### Gate 0: Development correctness
Required:
- syntax/tests pass;
- sandbox isolation verified;
- no production credentials referenced;
- no production endpoints mutated;
- BIST output is deterministic.

### Gate 1: Staging security
Required:
- authentication required;
- operator scopes bounded;
- execution allowlist active;
- destructive actions require approval;
- network reachability allowlisted;
- backup and restore verified;
- audit records generated.

### Gate 2: Production-candidate hardening
Required:
- all permissive controls have explicit removal evidence;
- public listeners are enumerated and justified;
- all secrets are production-managed;
- least-privilege scopes are verified;
- failure paths are fail-closed;
- stale lease/fencing tests pass;
- authenticated browser -> workspace -> WSS -> guest execution path passes;
- recovery acceptance passes;
- clean-host reconstruction is independently verified.

### Gate 3: Production launch
Required:
- BIST contains no unexplained FAIL;
- launch-critical NOT_PROVEN items are resolved or explicitly excluded;
- production restore point exists;
- rollback path is tested;
- monitoring and verification are active;
- no undocumented human setup step remains.

## 7. Fail-closed invariants

The following become non-negotiable outside DEV_SANDBOX:
- missing authentication => deny;
- missing authorization => deny;
- missing owner => do not execute;
- expired lease => do not complete;
- stale generation => reject;
- unknown tool => deny;
- unknown resource => deny;
- missing secret => fail closed;
- ambiguous routing => deny;
- failed acceptance gate => do not publish a user-facing access link;
- failed backup verification => do not declare recovery-ready;
- unverified public listener => block promotion;
- production boundary uncertainty => NOT_PROVEN.

## 8. Verification implementation

Verification must inspect effective state, not merely configuration files.

At minimum, the verifier should report:
- PHASE
- AUTH_REQUIRED
- AUTHZ_MODE
- PUBLIC_LISTENERS
- PRODUCTION_ENDPOINTS_REFERENCED
- SECRET_SOURCE
- EXECUTION_POLICY
- BACKUP_STATUS
- RESTORE_STATUS
- BIST_STATUS

The verifier must distinguish PASS, FAIL, NOT_PROVEN, and NOT_APPLICABLE.

A development verifier may report permissive controls as expected. It must not translate them into production PASS.

## 9. OCI OpenClaw application

The current OCI workstation already demonstrates several useful invariants:
- OpenClaw Gateway is loopback-only.
- Ollama is loopback-only.
- OpenClaw runs under a persistent systemd user service.
- user linger is enabled.
- verified local backups are scheduled.
- backup archive verification and restore-to-staging have been exercised.

These are development/staging foundations, not proof of production launch.

Still outstanding evidence includes:
- actual reboot survival;
- authenticated remote/operator path from Android;
- device pairing and least-privilege scopes;
- workspace/memory behavior;
- production-grade off-host recovery strategy.

These remain explicit gates rather than assumptions.

## 10. Promotion mechanism

Promotion is monotonic:

DEV_SANDBOX -> STAGING -> PROD_CANDIDATE -> PROD

A higher phase may tighten controls but may not inherit a weaker control accidentally.

Configuration should therefore use explicit phase selection. Production must reject an unknown phase rather than falling back to development.

Recommended rule:

unknown phase => FAIL

and:

PROD + permissive control => FAIL

The implementation should make the phase visible in every verification report and acceptance artifact.

## 11. Failure learning loop

Every incident becomes one of:
- contract clarification;
- verifier improvement;
- test case;
- architecture decision;
- operational runbook update.

The known curl-pipe/stdin failure is an example: the bootstrap contract now uses stdin-safe OpenClaw invocations. Similar failures should become durable repository knowledge instead of remaining operator folklore.

## 12. Exit criteria for removing permissiveness

A permissive control is removed only when:
1. the replacement control exists;
2. the replacement has a test;
3. the live verifier observes it;
4. the relevant acceptance scenario passes;
5. rollback is documented;
6. the old permissive path is disabled;
7. the evidence is committed.

This prevents temporary development shortcuts from becoming permanent attack surface.

## 13. Architecture rule

**Move quickly inside the sandbox. Move deliberately across trust boundaries. Fail closed at promotion.**

The architecture is intentionally optimized so that experimentation happens where failure is cheap, while production trust is earned through evidence.