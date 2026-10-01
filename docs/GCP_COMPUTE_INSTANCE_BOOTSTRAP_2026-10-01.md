# Google Cloud Compute instance bootstrap (Grasshopper / OmniKali / Broccoli)

**Date:** 2026-10-01  
**Purpose:** reproducible, atomic, least-privilege GCP worker aligned with Grasshopper control-plane philosophy and Broccoli execution substrate.  
**Priority:** documentation + starter code so nothing is forgotten while chat-archive work stays primary.

## Alignment with existing substrates

| Identifier | Role | Notes |
|------------|------|-------|
| aws-helix-worker-01 | Protected production / Helix base | Never interfere |
| oci-grasshopper-workstation | Experimental ARM64 workstation | Already in use |
| gcp-grasshopper-worker (proposed) | Secondary/experimental x86 or free-tier worker | This document |

GCP is an additional execution substrate, not a replacement. Same rules as OCI: isolated, reproducible, BIST-capable, explicit rollback, no production secrets.

## Free-tier baseline (Always Free)

- 1 non-preemptible **e2-micro** VM per month
- Regions only: `us-west1`, `us-central1`, `us-east1`
- 30 GB-months standard persistent disk
- 1 GB North-America egress (exclusions apply)
- External IP for the free-tier instance is not charged while the instance is running under the free allowance

Outside those regions or machine types the instance is billed. Always set a billing budget alert first.

## Atomic philosophy (from Broccoli / Grasshopper)

1. One intent → one schema → dry-run → execute → confirm → remember.
2. Collectors publish evidence; they do not silently remediate.
3. Known-good lower layers are called, never rewritten to paper over a broken caller.
4. Evidence labels: PROVEN / OBSERVED / NOT_PROVEN / DESIGN_ONLY / BLOCKED.
5. No undocumented operator steps. Everything needed to reproduce lives in the repo.

## Target identity

```
gcp-grasshopper-worker-01
  project: <user-project-id>          # never hard-code secrets
  region/zone: us-central1-a (or us-west1 / us-east1)
  machine: e2-micro
  disk: 30 GB standard persistent
  image: debian-12 or ubuntu-24.04 (free)
  network: default + explicit firewall tags only
  identity: instance principal / least-privilege SA when possible
```

## Bootstrap sequence (reproducible)

1. **Human / IAM gate**  
   - Create or select a GCP project.  
   - Enable Compute Engine API.  
   - Attach a billing account and immediately create a budget alert ($0.01 or low threshold).  
   - Create a dedicated service account with only the roles required for this worker (Compute Instance Admin limited, or custom). Prefer instance principals over long-lived keys.

2. **Dry-run declaration**  
   - Write the intended instance configuration as code (see `scripts/gcp-bootstrap.sh` scaffold).  
   - No live create until the declaration is reviewed.

3. **Create**  
   ```bash
   gcloud compute instances create gcp-grasshopper-worker-01 \
     --project="$GCP_PROJECT" \
     --zone=us-central1-a \
     --machine-type=e2-micro \
     --image-family=debian-12 \
     --image-project=debian-cloud \
     --boot-disk-size=30GB \
     --boot-disk-type=pd-standard \
     --tags=grasshopper-worker \
     --metadata=startup-script-url=gs://…/or inline minimal cloud-init
   ```

4. **BIST / acceptance**  
   - SSH (or IAP) and prove: OS, disk free, network, git clone of Grasshopper, `npm test` or equivalent, no production secrets present.  
   - Record evidence under `docs/LIVE_EVIDENCE_GCP_….md`.

5. **Role of the worker**  
   - Chat-archive heavy indexing / FTS build.  
   - Optional remote APKTool / Morphe patch jobs (later).  
   - Provider-agnostic browser automation for exports (ChatGPT / Grok / Gemini logged-in sessions) so the phone is not the only surface.  
   - Never holds production Helix/Kali state.

## What this instance must never do

- Touch AWS Helix / production CloudFront / nginx / libvirt path.
- Store long-lived production credentials.
- Commit raw chat exports.
- Weaken firewall or open unnecessary ports.
- Claim "production ready" until BIST and recovery evidence exist.

## Starter script location

See `scripts/gcp-bootstrap.sh` (scaffold). It is intentionally minimal and dry-run first.

## Status

| Item | Status |
|------|--------|
| Documentation | this file |
| Free-tier constraints | documented |
| Bootstrap script scaffold | added |
| Live instance | NOT_PROVEN (requires user GCP project + IAM) |
| BIST evidence | NOT_STARTED |
| Chat-archive worker role | PLANNED |

## Next atomic steps

1. User supplies or creates the GCP project id and confirms billing alert.  
2. Agent fills the dry-run config and produces the exact `gcloud` command.  
3. Create only after explicit human confirmation (or automated policy if later authorized).  
4. Run BIST and write live evidence.  
5. Point the chat-archive heavy jobs at this worker when the phone paging path is saturated.

Update this document and the system knowledge graph when the instance identity becomes PROVEN.
