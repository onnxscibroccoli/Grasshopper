# OCI OpenClaw Development Evidence 2026-10-01

**Phase:** DEV_SANDBOX  
**Host:** grasshopper-workstation  
**OpenClaw:** 2026.9.7 (c074824)  
**Scope:** read-only runtime verification plus disposable backup/recovery drill

## Live resource evidence

- Available memory: approximately 7.1 GiB.
- Root filesystem: 30 GiB total, approximately 5.6 GiB available.
- Gateway listener: loopback only on 127.0.0.1:18789 and ::1:18789.
- Ollama listener: loopback only on 127.0.0.1:11434.
- No public Gateway override was enabled.
- No production endpoint or production credential was referenced.
- No reboot was performed.

## Backup evidence

The development backup helper completed successfully.

- Archive: `/home/grasshopper/Backups/openclaw/2026-10-01T00-11-21.189+00-00-openclaw-backup.tar.gz`
- Size: 372615 bytes.
- Archive verification: PASS.
- OpenClaw runtime version recorded by the archive: 2026.9.7.
- Archive entries scanned: 62.
- Canonical SQLite inventory verification: PASS.

The supported OpenClaw backup mechanism skipped documented volatile runtime paths rather than copying live transient state.

## Recovery evidence

The fresh archive was verified and restored to:

`/tmp/openclaw-restore-drill-aXU6Rx/restored`

The restore operation completed successfully and a non-empty manifest was located at:

`/tmp/openclaw-restore-drill-aXU6Rx/restored/2026-10-01T00-11-21.189+00-00-openclaw-backup/manifest.json`

The restore was staging-only. The live OpenClaw state was not replaced and the Gateway was not stopped.

## Security phase verifier

The current `scripts/security-phase-verify.sh` was exercised against the live workstation with:

- `GRASSHOPPER_SECURITY_PHASE=DEV_SANDBOX`
- explicit sandbox identity
- permissive development mode
- broad development operator scopes
- backup status PASS
- restore status PASS
- public Gateway override disabled

Result:

`SECURITY_PHASE_VERIFY=PASS`

The contract suite contains seven cases and all seven passed:

- missing phase fails;
- unknown phase fails;
- explicit DEV_SANDBOX permissiveness passes;
- STAGING rejects permissive mode;
- STAGING rejects broad operator scopes;
- public Gateway override fails;
- missing recovery evidence fails.

## Evidence classification

This is **DEV_SANDBOX evidence**, not production certification.

Still unproven:

- actual reboot survival;
- authenticated Android/operator path;
- device pairing and production scopes;
- workspace/memory behavior;
- off-host backup recovery;
- complete authenticated desktop acceptance.

The workstation remains intentionally open inside its development boundary. Promotion gates, not premature hardening, provide the transition to staging and production controls.
