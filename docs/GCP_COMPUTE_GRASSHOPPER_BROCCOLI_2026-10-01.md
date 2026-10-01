# OmniKali Grasshopper + Broccoli Core on Google Cloud Compute

Date: 2026-10-01

## Deployment boundary

Compute Engine is the persistent Linux control/evidence worker. It is not a replacement for the Android phone transport.

Run on Compute Engine:
- Grasshopper control-plane source and tests.
- GitHub bounded evidence ingest and SQLite/FTS index.
- Broccoli Core Linux-safe runtime/archive/evidence research.
- Persistent worker state.
- Future APK/Morphe worker.

Keep on Android:
- Termux, Shizuku/Rish, lib/rish_run.sh.
- Android UI automation and uiautomator.
- Human-gated Android installation/authentication.
- Broccoli code that assumes Android/Termux paths or packages.

Broccoli Core's own README identifies it as Android/Termux-centric and historical, not the current OmniKali production source. Reuse it by provenance, not wholesale.

## 1. Select the GCP project

Run locally:

```bash
gcloud auth login
gcloud auth application-default login
gcloud config get-value project
```

If no project is selected:

```bash
gcloud projects list
gcloud config set project YOUR_PROJECT_ID
gcloud services enable compute.googleapis.com iam.googleapis.com iap.googleapis.com
```

Google documents Compute Engine VM creation, authentication, and required IAM permissions in its current Compute Engine documentation. citeturn2search4turn0search2

## 2. Create a worker service account

```bash
PROJECT_ID="$(gcloud config get-value project)"

gcloud iam service-accounts create omnikali-grasshopper   --display-name="OmniKali Grasshopper worker"
```

Initially give this account no broad project role. Add only roles required by later Google Cloud integrations. Google recommends user-managed service accounts with only the permissions the workload needs. citeturn0search6turn0search4

## 3. Enable OS Login

```bash
gcloud compute project-info add-metadata   --metadata=enable-oslogin=TRUE

gcloud projects add-iam-policy-binding "$PROJECT_ID"   --member="user:$(gcloud config get-value account)"   --role="roles/compute.osLogin"
```

Use roles/compute.osAdminLogin instead when sudo access is required. OS Login is Google's recommended access model for many Compute Engine environments. citeturn0search0turn0search11

## 4. Restrict SSH to IAP

```bash
gcloud compute firewall-rules create allow-ssh-from-iap   --direction=INGRESS   --action=allow   --rules=tcp:22   --source-ranges=35.235.240.0/20   --target-tags=omnikali-worker

gcloud projects add-iam-policy-binding "$PROJECT_ID"   --member="user:$(gcloud config get-value account)"   --role="roles/iap.tunnelResourceAccessor"
```

IAP TCP forwarding uses 35.235.240.0/20 and allows SSH to a VM without an external IP. citeturn1search0turn1search5

## 5. Create the VM

The initial recommended worker is e2-standard-2, Debian 12, with no public IP. Increase the machine size later for APK/Morphe work if measured workload requires it.

```bash
ZONE="us-central1-a"
VM="omnikali-grasshopper-gcp"

gcloud compute instances create "$VM"   --zone="$ZONE"   --machine-type="e2-standard-2"   --image-family="debian-12"   --image-project="debian-cloud"   --boot-disk-size="30GB"   --boot-disk-type="pd-balanced"   --network-interface=no-address   --tags="omnikali-worker"   --scopes="https://www.googleapis.com/auth/cloud-platform"   --service-account="omnikali-grasshopper@$PROJECT_ID.iam.gserviceaccount.com"   --shielded-secure-boot   --metadata=enable-oslogin=TRUE
```

Compute Engine supports public image families and the no-external-address network-interface option. citeturn2search0turn2search7

## 6. Attach durable storage

```bash
gcloud compute disks create omnikali-grasshopper-data   --zone="$ZONE"   --size=50GB   --type=pd-balanced

gcloud compute instances attach-disk "$VM"   --zone="$ZONE"   --disk=omnikali-grasshopper-data
```

Persistent Disk is durable network-backed storage and should hold the GitHub evidence index, archive journal, checkpoints, and worker state. citeturn0search8

After connecting, format and mount the new disk only after identifying the correct device with lsblk. Do not blindly format a disk.

## 7. Connect

```bash
gcloud compute ssh "$VM"   --zone="$ZONE"   --tunnel-through-iap
```

IAP is specifically designed to tunnel administrative protocols to VMs without public addresses. citeturn1search0

## 8. Bootstrap Linux dependencies

```bash
sudo apt-get update
sudo apt-get install -y git python3 python3-venv python3-pip sqlite3 jq curl ca-certificates

sudo useradd --create-home --shell /bin/bash omnikali 2>/dev/null || true
sudo mkdir -p /opt/omnikali/src /var/lib/omnikali
sudo chown -R omnikali:omnikali /opt/omnikali /var/lib/omnikali
```

Install the pinned Node 22 toolchain:

```bash
cd /tmp
curl -fsSLO https://nodejs.org/dist/v22.23.3/node-v22.23.3-linux-x64.tar.xz
sudo tar -xJf node-v22.23.3-linux-x64.tar.xz -C /opt
sudo ln -sfn /opt/node-v22.23.3-linux-x64 /opt/node
sudo ln -sfn /opt/node/bin/node /usr/local/bin/node
sudo ln -sfn /opt/node/bin/npm /usr/local/bin/npm
node --version
npm --version
```

Node publishes signed release artifacts for the v22 line. Pin the exact version in reproducible deployments. citeturn1search12

## 9. Clone Grasshopper and Broccoli Core

```bash
sudo -u omnikali git clone https://github.com/onnxscibroccoli/Grasshopper.git   /opt/omnikali/src/Grasshopper

sudo -u omnikali git clone https://github.com/onnxscibroccoli/broccoli-core.git   /opt/omnikali/src/broccoli-core

sudo -u omnikali bash -lc '
cd /opt/omnikali/src/Grasshopper
printf "Grasshopper "; git rev-parse HEAD
cd /opt/omnikali/src/broccoli-core
printf "Broccoli Core "; git rev-parse HEAD
'
```

Always record the exact source commits used by a worker.

## 10. Verify Grasshopper

```bash
sudo -u omnikali bash -lc '
cd /opt/omnikali/src/Grasshopper
npm install
npm test
python3 -m py_compile tools/github-ingest/github_ingest.py tools/github-ingest/query.py
'
```

The clean test result is the deployment gate, not the fact that the process started.

## 11. Build the durable GitHub evidence index

```bash
sudo -u omnikali mkdir -p /var/lib/omnikali/github-index

sudo -u omnikali bash -lc '
cd /opt/omnikali/src/Grasshopper
export OMNIKALI_GITHUB_INDEX_ROOT=/var/lib/omnikali/github-index
export OMNIKALI_GITHUB_API_ONLY=1
export OMNIKALI_GITHUB_MAX_TEXT_FILES=300

python3 tools/github-ingest/github_ingest.py sync onnxscibroccoli/Grasshopper --ref main
python3 tools/github-ingest/github_ingest.py sync onnxscibroccoli/broccoli-core --ref main
python3 tools/github-ingest/github_ingest.py status
'
```

API-only mode is useful for the first production validation because it prevents silent fallback to the Git partial-clone path.

## 12. Verify provenance search

```bash
sudo -u omnikali bash -lc '
cd /opt/omnikali/src/Grasshopper
export OMNIKALI_GITHUB_INDEX_ROOT=/var/lib/omnikali/github-index
python3 tools/github-ingest/query.py archive --limit 10
'
```

Every result should contain repository, commit SHA, path, blob SHA, category, snippet, and provenance source.

The read-only MCP facade is named:

`omnikali_search_github_evidence`

It does not execute Git commands or mutate the index.

## 13. Reuse Broccoli Core selectively

Create a separate Linux environment:

```bash
sudo -u omnikali python3 -m venv /opt/omnikali/broccoli-venv

sudo -u omnikali bash -lc '
source /opt/omnikali/broccoli-venv/bin/activate
cd /opt/omnikali/src/broccoli-core
python -m pip install --upgrade pip
python -m compileall -q runtime tools modules 2>/dev/null || true
python - <<'"PY"'
from runtime.kernel import Kernel
print("BROCCOLI_LINUX_KERNEL_IMPORT_OK", Kernel.__name__)
PY
'
```

Do not run Android/Termux UI scripts on this VM. Rish, Shizuku, uiautomator, Android package operations, and human-gated Android installation remain on the phone.

## 14. Architecture split

```text
Google Compute Engine
  |
  +-- Grasshopper control/evidence worker
  +-- GitHub bounded ingest + FTS
  +-- Broccoli archive/provenance/runtime research
  +-- future APK/Morphe worker
  |
  +-- authenticated control path
          |
          v
Android phone
  |
  +-- Termux
  +-- Rish/Shizuku
  +-- Android UI / uiautomator
  +-- human gates
```

## 15. Persistent layout

```text
/var/lib/omnikali/
  github-index/
  broccoli/
    archive-journal/
  checkpoints/
  evidence/
```

Raw conversation exports and credentials stay outside Git. The derived index remains rebuildable and provenance-linked.

## 16. Production gates

Do not call the GCP worker production-ready until all are true:

- VM has no external IP.
- OS Login works.
- IAP SSH works.
- Persistent Disk survives reboot.
- Grasshopper commit is recorded.
- Broccoli Core commit is recorded.
- Grasshopper tests pass.
- Both repositories ingest successfully.
- Protected-path exclusion is observed.
- Exact Git blob verification passes.
- MCP evidence query returns repository/commit/path/blob provenance.
- Concurrent ingest is fail-closed.
- VM restart preserves the evidence index.
- Android/Rish remains a separate transport boundary.
- No credentials appear in source, manifests, logs, or KG.

This is a persistent agent/evidence/control worker, not yet the complete OmniKali remote desktop. The remote Kali desktop remains a separate acceptance path.
