# OCI Google Cloud CLI interpreter repair — 2026-10-07

Contract `OCI-GCLOUD-CLI-20261007`: repair the existing SDK interpreter boundary on verified OCI `grasshopper-workstation`, Linux aarch64, via RDC node `0852e6f4-2507-4d0f-9d62-f6eda8cdd169`. Source lives on `feat/oci-gcloud-cli-env-20261007`; its exact revision is the Git commit containing this record. The independent checkout is `/srv/grasshopper/android/development/Grasshopper-gcloud-cli`.

## Failure and repair

The existing `/home/grasshopper/.google-cloud-sdk/bin/gcloud` failed with unsupported OS Python 3.9. The SDK itself was preserved. The user-scoped entrypoint `/home/grasshopper/.local/bin/gcloud` now sets `CLOUDSDK_PYTHON` to standalone CPython 3.13.7 under `/srv/grasshopper/android/development/cli-runtime/python` and delegates to that same SDK.

The installer uses pinned official Astral uv 0.12.23, Linux aarch64 archive SHA256 `6524bd338177ed50d035d39354e12545e993bbeba2ecbddf0480c5b3a81d313f`. uv downloads its managed CPython 3.13.7 distribution from python-build-standalone. This pins the Python version through uv's release manifest; this repository does not separately vendor or lock the Python archive digest. Documentation: https://docs.astral.sh/uv/guides/install-python/. No OS interpreter, sudo policy, credentials, SDK auth configuration, APIs, billing, or VM settings were changed.

## Reproduction

Run from any working directory using this checkout's absolute script path:

```sh
timeout 300 bash /srv/grasshopper/android/development/Grasshopper-gcloud-cli/scripts/cli/setup-gcloud-python.sh
/home/grasshopper/.local/bin/gcloud version
/home/grasshopper/.local/bin/gcloud auth list --filter=status:ACTIVE --format='json(account,status)' --quiet
```

`GCLOUD_RUNTIME_DIR`, `GCLOUD_SDK_DIR`, and `GCLOUD_BIN_DIR` explicitly select paths; `GCLOUD_PYTHON` can select an already installed Python 3.10–3.15 and skip downloads. Installation requires an existing Google Cloud SDK and an available `curl`, `tar`, `sha256sum`, Bash, and outbound GitHub connectivity. The default managed installer supports Linux aarch64 only. Do not use Android shell Rish for Termux's CLI interpreter.

## Fresh acceptance evidence

- Pre-repair SDK version: failed with unsupported Python 3.9.
- uv archive digest verification: passed; CPython 3.13.7 installed in 2.13 seconds.
- `command -v gcloud` resolves `/home/grasshopper/.local/bin/gcloud` in the RDC host shell.
- SDK version before and after entrypoint installation: both passed, Google Cloud SDK 588.0.0, core 2026.10.02, bq 2.1.39, gsutil 5.37.
- Active auth metadata: command returned `[]`; warning that `status` filter had no resource keys. This is **NOT_AUTHENTICATED**, not a successful cloud authorization gate.
- Read-only `projects describe omnikali`: failed with `You do not currently have an active account selected`. No login was initiated and phone credentials were not copied.
- Four setup boundary tests passed: paths/arguments including spaces, original launcher backup, SDK failure preservation, interpreter failure preservation, and corrupted download rejection (backup and quoting share one test).
- Full repository suite passed: 236 tests, zero failures. Broccoli degradation guard passed. No live Android/R2 acceptance is implied by these CLI results.

The phone separately has working authenticated gcloud access; phone metadata showed project `omnikali` ACTIVE, billing disabled, and Compute API disabled. CLI repair alone does not make GCP Compute or Vertex AI usable.

## Resource lease and recovery

Installation was scoped to one user, about 151 MiB persistent disk, an observed 10.64-second run; use a 300-second outer timeout and budget 512 MiB memory and 250 MiB disk for bootstrap. This is an admission estimate, not cgroup enforcement. Runtime tools are short-lived and no daemon is installed. API checks had 35-second individual timeouts.

Before replacing any existing user entrypoint, the script preserves it as `cli-runtime/gcloud-entrypoint-backup-<UTC>-<PID>` and verifies Python plus SDK version. Recovery is to restore that exact backup with `cp -a`, or remove only the newly created `~/.local/bin/gcloud` if no previous file existed. No entrypoint existed before this installation. The original SDK and OS Python remain available. Do not delete the shared CLI runtime while another command is using it.

Next contract: use existing OCI Git/Antigravity and authenticated phone gcloud for read-only diagnostics. OCI GCP authentication and project billing/API readiness remain explicit blockers; do not provision capacity or enable services under this repair contract.
