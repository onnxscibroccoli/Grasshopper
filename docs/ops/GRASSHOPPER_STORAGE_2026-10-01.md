# Grasshopper storage evidence - 2026-10-01

## Current evidence

- OCI instance: `Grasshopper-Workstation`
- Shape: `VM.Standard.A1.Flex`
- Region: `us-ashburn-1`
- Root filesystem: 30 GB, 26 GB used, 4.0 GB available, 87% used
- Existing persistent `/var/oled`: 15 GB, about 320 MB used, about 15 GB available, 3% used
- `/var/oled` is XFS and declared in `/etc/fstab`, so it is persistent across reboot.
- `/var/oled/pcp` is actively used by Performance Co-Pilot and must not be repurposed or deleted.

## Safe target layout

The intended Grasshopper storage namespace is:

```text
/var/oled/grasshopper/
  builds/
  cache/
  archives/
  logs/
```

The directory has not been created because the RDC execution identity is `grasshopper`, while `/var/oled` is root-owned and does not grant write access. No permissions were weakened.

## OCI block-volume gate

The instance metadata confirms the OCI compartment and instance identity. Instance-principal access to the Block Storage API was tested and returned `NotAuthorizedOrNotFound`. Therefore creation/attachment of a new OCI Block Volume is **OPEN / HUMAN_OR_IAM_REQUIRED** until the instance policy permits the operation or an authorized OCI workflow performs it.

## Cold-cache candidates

The following regenerable caches account for roughly 1.3 GB on root and are candidates for relocation after a privileged storage mount exists:

- `~/.cache/ms-playwright` ~662 MB
- `~/.cache/puppeteer` ~662 MB

They were not moved during this pass because the current Desktop Commander runtime is active and the target volume is not writable by the session.

## Safety rule

Do not move or delete active container storage, Ollama models, OpenClaw runtime tools, Git worktrees, Broccoli/Grasshopper working trees, or package-manager runtime state merely to lower the percentage. Relocation requires an ownership check, process check, byte verification, and rollback path.
