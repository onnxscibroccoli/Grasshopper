#!/usr/bin/env bash
# scripts/gcp-bootstrap.sh
# Atomic, dry-run-first bootstrap for a free-tier GCP Grasshopper worker.
# Philosophy: one intent, explicit evidence, no secrets in repo, never touch production Helix.
#
# Usage:
#   export GCP_PROJECT=your-project-id
#   ./scripts/gcp-bootstrap.sh --dry-run
#   ./scripts/gcp-bootstrap.sh --create   # only after human review of dry-run output

set -Eeuo pipefail

INSTANCE_NAME="${INSTANCE_NAME:-gcp-grasshopper-worker-01}"
ZONE="${ZONE:-us-central1-a}"
MACHINE_TYPE="${MACHINE_TYPE:-e2-micro}"
DISK_SIZE="${DISK_SIZE:-30GB}"
IMAGE_FAMILY="${IMAGE_FAMILY:-debian-12}"
IMAGE_PROJECT="${IMAGE_PROJECT:-debian-cloud}"
TAGS="grasshopper-worker"

usage() {
  cat <<EOF
Usage: $0 [--dry-run|--create|--help]

Environment:
  GCP_PROJECT   required for --create
  ZONE          default us-central1-a (must be free-tier region)
  INSTANCE_NAME default gcp-grasshopper-worker-01

Free-tier regions only: us-west1, us-central1, us-east1
Machine type must remain e2-micro for Always Free.
EOF
}

dry_run() {
  echo "=== DRY-RUN: intended GCP instance declaration ==="
  echo "project:        ${GCP_PROJECT:-<unset>}"
  echo "name:           $INSTANCE_NAME"
  echo "zone:           $ZONE"
  echo "machine:        $MACHINE_TYPE"
  echo "disk:           $DISK_SIZE pd-standard"
  echo "image:          $IMAGE_PROJECT/$IMAGE_FAMILY"
  echo "tags:           $TAGS"
  echo
  echo "gcloud command that would run:"
  cat <<CMD
gcloud compute instances create "$INSTANCE_NAME" \\
  --project="\$GCP_PROJECT" \\
  --zone="$ZONE" \\
  --machine-type="$MACHINE_TYPE" \\
  --image-family="$IMAGE_FAMILY" \\
  --image-project="$IMAGE_PROJECT" \\
  --boot-disk-size="$DISK_SIZE" \\
  --boot-disk-type=pd-standard \\
  --tags="$TAGS"
CMD
  echo
  echo "Evidence label after success: PROVEN (instance exists + BIST)"
  echo "Until then: NOT_PROVEN"
}

do_create() {
  if [[ -z "${GCP_PROJECT:-}" ]]; then
    echo "ERROR: GCP_PROJECT must be set" >&2
    exit 1
  fi
  case "$ZONE" in
    us-west1-*|us-central1-*|us-east1-*) ;;
    *)
      echo "ERROR: zone $ZONE is outside Always Free regions" >&2
      exit 1
      ;;
  esac
  if [[ "$MACHINE_TYPE" != "e2-micro" ]]; then
    echo "ERROR: machine type must be e2-micro for free tier" >&2
    exit 1
  fi

  echo "Creating $INSTANCE_NAME in $ZONE …"
  gcloud compute instances create "$INSTANCE_NAME" \
    --project="$GCP_PROJECT" \
    --zone="$ZONE" \
    --machine-type="$MACHINE_TYPE" \
    --image-family="$IMAGE_FAMILY" \
    --image-project="$IMAGE_PROJECT" \
    --boot-disk-size="$DISK_SIZE" \
    --boot-disk-type=pd-standard \
    --tags="$TAGS"

  echo "Instance created. Next: run BIST and write docs/LIVE_EVIDENCE_GCP_….md"
}

main() {
  case "${1:---dry-run}" in
    --dry-run) dry_run ;;
    --create)  do_create ;;
    --help|-h) usage ;;
    *) usage; exit 1 ;;
  esac
}

main "$@"
