# Grasshopper Security Phase Model

**Status:** Proposed architecture contract  
**Scope:** Grasshopper Phase 2 / OmniKali development, staging, and production boundaries

## 1. Design principle

Grasshopper deliberately uses different operating philosophies at different lifecycle stages.

**Development optimizes for velocity, accessibility, experimentation, and recoverability. Production optimizes for controlled trust and fail-closed behavior.**

The development environment should not become difficult to use merely because it is possible to make it more restrictive. During architecture discovery, continuous access to development tools and open configurations produce faster learning and better evidence.

The safety mechanism for this phase is primarily:

- isolation from production;
- durable, verified backups;
- disposable resources;
- rapid rebuild;
- observable state;
- reproducible bootstrap;
- promotion gates.

Security restrictions are tightened when the system crosses into staging and production, not preemptively imposed on every development experiment.

The phases are:

- `DEV_SANDBOX`: maximum practical velocity and accessibility.
- `STAGING`: production-shaped validation with bounded trust.
- `PROD_CANDIDATE`: fail-closed hardening and launch evidence.
- `PROD`: least privilege, durable recovery, and continuous verification.

No production control may silently inherit development permissiveness.

## 2. Immutable production boundary

The validated production path remains:

`CloudFront -> nginx -> Helix :8092 -> libvirt/QEMU -> helix-omnikali -> Kali`

Development must remain independently recoverable and must not mutate that production path merely to make experimentation easier.

The development environment therefore receives freedom **inside its own boundary**, rather than freedom to cross the production boundary.

## 3. Phase policy

| Control | DEV_SANDBOX | STAGING | PROD_CANDIDATE | PROD |
|---|---|---|---|---|
| Development-tool access | continuously available | bounded | controlled | least privilege |
| Network reachability | open inside isolated development boundary | allowlisted | allowlisted | allowlisted |
| Gateway bind | loopback/private | loopback/private | loopback/private | loopback/private |
| Authentication | convenient/disposable test identity | required | required | required |
| Authorization | broad test scopes | bounded scopes | least privilege | least privilege |
| Tool execution | broad experimentation | bounded | allowlist + approvals | allowlist + approvals |
| Destructive actions | allowed against disposable resources | gated | gated + evidence | explicit approval/policy |
| Data | synthetic/test data | sanitized | production-shaped, non-sensitive | production data |
| Persistence | strongly preferred | required | required | required |
| Backup | rapid, frequent, verified | required + restore test | verified restore | verified restore |
| Audit | useful diagnostics | structured | retained | retained/continuous |
| Failure behavior | favor diagnostics and recovery | fail closed at trust boundary | fail closed | fail closed |
| Acceptance | rapid integration tests | authenticated live tests | launch gate | continuous verification |

The DEV_SANDBOX row is intentionally permissive. It is not a production security baseline.

## 4. Development operating model

The development environment should feel like an always-available laboratory.

Preferred characteristics:

- persistent development workstation;
- continuous access to shell, browser, agents, logs, model endpoints, and development APIs;
- open configuration for rapid experimentation;
- broad operator permissions when limited to development resources;
- fast service restart;
- easy reset;
- easy cloning;
- automatic backups;
- rapid restore;
- disposable infrastructure;
- no production dependency.

The default response to a development failure should be:

`observe -> back up -> repair or reset -> reproduce -> learn`

rather than:

`lock down -> wait for approval -> manually recover`

This maximizes iteration speed while retaining a durable recovery path.

## 5. Security boundary for permissive development

Permissiveness is acceptable when the resource itself is disposable or independently recoverable.

The critical rule is:

**Open development configuration must not create open production access.**

DEV_SANDBOX may use:

- broad operator scopes;
- convenient authentication for development;
- experimental agents;
- experimental models;
- broad development tools;
- relaxed internal network policy;
- automatic startup;
- direct diagnostic access;
- destructive tests against disposable resources.

DEV_SANDBOX must not receive:

- production credentials;
- unrestricted production database access;
- authority to replace production ingress;
- authority to mutate the validated production desktop;
- production identity reuse.

This is the main security control during early development: **boundary isolation plus recoverability**, rather than restrictive controls on the developer's hands.

## 6. Backup-first development security

Because development intentionally remains accessible, backups become a primary resilience control.

Every persistent development system should have:

1. automatic backup;
2. archive verification;
3. retention policy;
4. documented restore procedure;
5. restore-to-staging capability;
6. periodic recovery drill.

A backup is not considered valid merely because an archive exists.

Required evidence:

`create -> verify -> restore -> inspect -> accept`

For stateful agent systems, supported application backup mechanisms must be used rather than copying live database files in unsafe states.

The OCI OpenClaw work already follows this model:

- scheduled local backup;
- verified archive;
- restore-to-staging;
- explicit evidence of the recovery operation.

The next maturity step is off-host recovery.

## 7. Four architecture planes

### Plane A: Human/operator

`Developer -> development transport -> operator client -> development services`

During DEV_SANDBOX, optimize for accessibility.

During later phases, progressively add:

- authenticated identity;
- device identity;
- bounded scopes;
- approvals;
- audit.

The development Gateway can remain loopback/private while still being highly accessible through an authenticated developer transport.

### Plane B: Control plane

Owns:

- durable state;
- task lifecycle;
- leases;
- authorization;
- recovery;
- audit;
- acceptance evidence.

Even during development, the control plane should preserve state correctness.

### Plane C: Execution plane

Development execution can be broad, but it must remain fenced to development resources.

The production invariants remain:

- owner;
- lease;
- generation;
- fencing;
- deterministic recovery.

### Plane D: Guest/workstation

The persistent Kali workstation is a development asset and may remain highly accessible.

Persistence does not equal production authorization.

A restored workstation is still required to pass the appropriate promotion/acceptance path before becoming a production workstation.

## 8. Promotion gates

### Gate 0: DEV_SANDBOX

Optimize for learning velocity.

Required:

- development boundary identified;
- production credentials absent;
- backup functioning;
- restore path known;
- bootstrap reproducible;
- failures observable.

Restrictive production-style controls are not required unless the experiment itself concerns those controls.

### Gate 1: STAGING

Introduce the controls that the actual product will need:

- authentication;
- bounded authorization;
- bounded execution;
- approval for destructive operations;
- allowlisted network paths;
- verified backup/restore;
- structured audit.

### Gate 2: PROD_CANDIDATE

Now convert the architecture from permissive to fail-closed.

Required:

- every remaining permissive exception identified;
- every exception has a removal decision;
- public listeners enumerated;
- production secret sources verified;
- least-privilege scopes verified;
- unknown actions denied;
- failed authentication denied;
- failed authorization denied;
- stale execution rejected;
- recovery acceptance passed;
- clean-host reconstruction independently verified;
- authenticated browser -> workspace -> WSS -> guest path passed.

### Gate 3: PROD

Production requires:

- fail-closed trust boundaries;
- least privilege;
- durable audit;
- verified recovery;
- rollback;
- continuous BIST;
- no undocumented human setup.

## 9. Fail-closed production invariants

Outside DEV_SANDBOX:

- missing authentication => deny;
- missing authorization => deny;
- missing owner => do not execute;
- expired lease => do not complete;
- stale generation => reject;
- unknown tool => deny;
- unknown resource => deny;
- missing secret => fail closed;
- ambiguous routing => deny;
- failed acceptance => do not publish access;
- failed backup verification => not recovery-ready;
- unverified public listener => block promotion;
- unknown security phase => fail.

## 10. Verification

Verification must inspect effective state, not merely intended configuration.

At minimum report:

- `PHASE`
- `AUTH_REQUIRED`
- `AUTHZ_MODE`
- `PUBLIC_LISTENERS`
- `PRODUCTION_ENDPOINTS_REFERENCED`
- `SECRET_SOURCE`
- `EXECUTION_POLICY`
- `BACKUP_STATUS`
- `RESTORE_STATUS`
- `BIST_STATUS`

Use:

- `PASS`
- `FAIL`
- `NOT_PROVEN`
- `NOT_APPLICABLE`

Development permissiveness must be reported as development state, not converted into production PASS.

## 11. OCI OpenClaw application

The current OCI workstation is a good example of the intended development model:

- OpenClaw Gateway remains loopback-only;
- Ollama remains loopback-only;
- OpenClaw has persistent systemd supervision;
- user linger is enabled;
- development tools remain available;
- verified local backups are scheduled;
- backup archive verification has passed;
- restore-to-staging has been exercised.

The remaining evidence is deliberately treated as future gates:

- actual reboot survival;
- authenticated Android/operator path;
- device pairing and production scopes;
- workspace/memory behavior;
- off-host recovery;
- complete authenticated desktop acceptance.

We should not impose production restrictions on the workstation simply to claim that it is secure. Instead, we should make its development boundary explicit and its recovery excellent.

## 12. Promotion is a deliberate change of operating model

`DEV_SANDBOX -> STAGING -> PROD_CANDIDATE -> PROD`

The transition should progressively replace:

`accessibility + recovery`

with:

`identity + authorization + approval + verification`

The development environment therefore stays fast until the architecture is sufficiently understood to justify tightening it.

Unknown phase:

`FAIL`

Production plus development permissiveness:

`FAIL`

Development plus verified isolation and recoverability:

`VALID DEV STATE`

## 13. Failure learning loop

Every development failure is valuable evidence.

Convert it into one or more of:

- architecture decision;
- verifier improvement;
- regression test;
- bootstrap improvement;
- operational runbook;
- recovery drill.

The curl-pipe/stdin problem is an example: the failure became a durable bootstrap rule rather than a recurring operator trap.

The same principle applies to every new blocker.

## 14. Removing development permissiveness

A development control is not removed merely because it looks insecure.

It is removed when:

1. the corresponding architecture is understood;
2. a production requirement exists for the restriction;
3. the replacement control exists;
4. the replacement has a test;
5. live verification observes it;
6. acceptance passes;
7. rollback is understood;
8. the old development path is no longer required.

This prevents premature hardening from slowing discovery while still guaranteeing a path to production hardening.

## 15. Architecture rule

**Keep development open, accessible, recoverable, and fast. Keep it isolated from production. Harden at promotion. Fail closed at the production boundary.**

The security strategy is therefore not “restrict everything immediately.”

It is:

`OPEN DEVELOPMENT + STRONG BACKUP + HARD BOUNDARY + EVIDENCE-DRIVEN PROMOTION`

That is the operating model optimized for rapid Grasshopper Phase 2 iteration.