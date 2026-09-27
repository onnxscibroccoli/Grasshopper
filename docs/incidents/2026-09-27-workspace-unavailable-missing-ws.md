# Production Incident Evidence: OmniKali Workspace Unavailable

**Date:** 2026-09-27  
**System:** Verified OmniKali / Helix production baseline  
**Status:** Resolved and verified

## Purpose

This record preserves the production evidence and recovery procedure for a workspace outage discovered during mobile-browser acceptance testing.

Grasshopper treats deployed production behavior as evidence. This incident therefore records the observed failure without treating the deployed artifact as the desired implementation. The durable requirement is that an authorized agent must be able to reproduce the working state from source with no undocumented dependency installation.

## Symptom

The OmniKali mobile UI displayed:

```text
workspace unavailable
```

The desktop viewport was blank while the mobile control surface remained available.

The user-visible workstation page itself loaded correctly.

## Production evidence

The underlying Kali VM remained healthy:

- QEMU/KVM guest running
- QEMU guest agent responding
- VNC available
- websockify/noVNC available
- persistent workspace remained intact

The failing component was the Helix hypervisor reconciliation service.

Its startup error was:

```text
Error [ERR_MODULE_NOT_FOUND]:
Cannot find package 'ws'
imported from /opt/helix/scripts/hypervisor-daemon.mjs
```

The source repository already declared `ws@^8.21.3`, including the locked package in `package-lock.json`. The deployed runtime dependency tree was incomplete.

## Failure chain

```text
source declares ws
        ↓
deployed node_modules omitted ws
        ↓
hypervisor-daemon.mjs cannot import ws
        ↓
helix-libvirt-hypervisor crashes
        ↓
systemd restarts it every 3 seconds
        ↓
workspace reconciliation unavailable
        ↓
workspace API unavailable
        ↓
mobile desktop reports "workspace unavailable"
```

## Recovery

The production host was repaired in place:

1. Verified the dependency declaration in the Helix source.
2. Installed the missing `ws@8.21.3` runtime package on the authorized production host.
3. Reset the failed systemd state.
4. Restarted the hypervisor service.
5. Verified the hypervisor health endpoint.
6. Verified the gateway remained active.
7. Verified the Kali guest and guest agent.
8. Monitored the service after recovery.
9. User confirmed the desktop launched successfully.

## Reproducibility requirement

The direct production repair is evidence of the required state, not the final source-of-truth fix.

Grasshopper's reconstruction requirements must ensure that deployment performs a complete dependency installation from the committed lockfile before starting production services.

Minimum deployment gate:

```bash
npm ci
node -e 'console.log(require.resolve("ws"))'
systemctl restart helix-libvirt-hypervisor.service
curl -fsS http://127.0.0.1:8090/health
systemctl is-active helix-libvirt-hypervisor.service
```

The acceptance gate must fail if the declared runtime dependency is absent from the deployed artifact.

## Architectural lesson

A healthy guest does not imply a healthy workspace control path.

The production dependency chain is:

```text
mobile UI
  → authenticated gateway
  → workspace/control-plane API
  → hypervisor reconciliation
  → QEMU/libvirt
  → Kali guest
  → VNC/websockify
```

Failure at the hypervisor reconciliation layer can leave the guest running while the workspace is nevertheless unavailable.

This distinction belongs in future recovery and acceptance procedures.

## Related production evidence

The incident is related to, but distinct from, the earlier CloudFront origin availability incident documented in Helix issue #6. Together they demonstrate two separate recovery classes:

1. origin/host availability;
2. deployed-runtime dependency integrity.

Both must be covered by the production acceptance and reconstruction gates.
