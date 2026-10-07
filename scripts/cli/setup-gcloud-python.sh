#!/usr/bin/env bash
# User-scoped Google Cloud CLI interpreter setup. Never modifies OS Python or auth.
set -euo pipefail
runtime=${GCLOUD_RUNTIME_DIR:-/srv/grasshopper/android/development/cli-runtime}
sdk=${GCLOUD_SDK_DIR:-$HOME/.google-cloud-sdk}
bin_dir=${GCLOUD_BIN_DIR:-$HOME/.local/bin}
python=${GCLOUD_PYTHON:-}
uv_version=0.12.23
uv_sha=6524bd338177ed50d035d39354e12545e993bbeba2ecbddf0480c5b3a81d313f
python_version=3.13.7
[[ -x "$sdk/bin/gcloud" ]] || { echo "Google Cloud SDK launcher missing: $sdk/bin/gcloud" >&2; exit 1; }
mkdir -p "$runtime" "$bin_dir"
if [[ -z "$python" ]]; then
  [[ $(uname -m) == aarch64 && $(uname -s) == Linux ]] || { echo "Pinned installer supports Linux aarch64 only; supply GCLOUD_PYTHON for another platform" >&2; exit 1; }
  archive="$runtime/uv-$uv_version-aarch64.tar.gz"
  curl --fail --location --retry 2 --max-time 120 -o "$archive" "https://github.com/astral-sh/uv/releases/download/$uv_version/uv-aarch64-unknown-linux-gnu.tar.gz"
  printf '%s  %s\n' "$uv_sha" "$archive" | sha256sum --check --status
  tar -xzf "$archive" -C "$runtime"
  uv="$runtime/uv-aarch64-unknown-linux-gnu/uv"
  UV_PYTHON_INSTALL_DIR="$runtime/python" "$uv" python install "$python_version" --no-bin
  python=$(UV_PYTHON_INSTALL_DIR="$runtime/python" "$uv" python find "$python_version" --managed-python)
fi
[[ -x "$python" ]] || { echo "Selected Python is not executable" >&2; exit 1; }
"$python" -c 'import sys; assert (3,10) <= sys.version_info[:2] <= (3,15), "gcloud needs Python 3.10 through 3.15"'
# Version verification occurs before replacing any entrypoint; credentials are not read.
CLOUDSDK_PYTHON="$python" "$sdk/bin/gcloud" version
entrypoint="$bin_dir/gcloud"
if [[ -e "$entrypoint" || -L "$entrypoint" ]]; then
  backup="$runtime/gcloud-entrypoint-backup-$(date -u +%Y%m%dT%H%M%S)-$$"
  cp -a "$entrypoint" "$backup"
  printf 'BACKUP=%s\n' "$backup"
fi
tmp=$(mktemp "$bin_dir/.gcloud.XXXXXX")
trap 'rm -f "$tmp"' EXIT
{
  printf '#!/usr/bin/env bash\n'
  printf 'export CLOUDSDK_PYTHON=%q\n' "$python"
  printf 'exec %q "$@"\n' "$sdk/bin/gcloud"
} > "$tmp"
chmod 755 "$tmp"
mv -f "$tmp" "$entrypoint"
printf 'ENTRYPOINT=%s\nPYTHON=%s\n' "$entrypoint" "$python"
"$entrypoint" version
