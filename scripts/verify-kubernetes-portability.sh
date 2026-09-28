#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHART="$ROOT/deploy/helm/omnikali"
command -v helm >/dev/null || { echo "helm is required" >&2; exit 1; }
rendered="$(helm template omnikali "$CHART")"
for forbidden in 'arn:aws:' 'projects/' 'subscriptions/' 'resourceGroups/' 'ocid1.'; do
  if grep -Fq "$forbidden" <<<"$rendered"; then
    echo "provider-specific identifier leaked into portable chart: $forbidden" >&2
    exit 1
  fi
done
grep -q 'kind: Deployment' <<<"$rendered"
grep -q 'kind: Service' <<<"$rendered"
grep -q 'kind: PersistentVolumeClaim' <<<"$rendered"
grep -q 'kind: NetworkPolicy' <<<"$rendered"
echo "Portable Kubernetes chart validation: PASS"
