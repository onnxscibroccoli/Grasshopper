#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
PROJECT_DIR="${REPO_ROOT}/apps/android-controller"
GRADLE_VERSION="8.9"
DIST_BASE="https://services.gradle.org/distributions"
CACHE_DIR="${GRADLE_USER_HOME:-${HOME}/.gradle}/omnikali-pinned-distributions"
GRADLE_BIN="${CACHE_DIR}/gradle-${GRADLE_VERSION}/bin/gradle"

if [[ ! -x "${GRADLE_BIN}" ]]; then
  mkdir -p "${CACHE_DIR}"
  archive="${CACHE_DIR}/gradle-${GRADLE_VERSION}-bin.zip"
  checksum_file="${CACHE_DIR}/gradle-${GRADLE_VERSION}-bin.zip.sha256"
  curl --fail --location --silent --show-error "${DIST_BASE}/gradle-${GRADLE_VERSION}-bin.zip" --output "${archive}"
  curl --fail --location --silent --show-error "${DIST_BASE}/gradle-${GRADLE_VERSION}-bin.zip.sha256" --output "${checksum_file}"
  expected="$(awk 'NR == 1 { print $1 }' "${checksum_file}")"
  [[ "${expected}" =~ ^[[:xdigit:]]{64}$ ]] || {
    echo "Invalid official Gradle SHA-256 response" >&2
    exit 70
  }
  printf '%s  %s\n' "${expected}" "${archive}" | sha256sum --check --status || {
    echo "Gradle distribution checksum verification failed" >&2
    rm -f "${archive}"
    exit 71
  }
  unzip -q -o "${archive}" -d "${CACHE_DIR}"
  rm -f "${archive}" "${checksum_file}"
fi

if [[ ! -f "${PROJECT_DIR}/settings.gradle.kts" || ! -f "${PROJECT_DIR}/app/build.gradle.kts" ]]; then
  echo "Android controller Gradle project is incomplete" >&2
  exit 72
fi

if [[ "$#" -eq 0 ]]; then
  set -- :app:testDebugUnitTest :app:assembleDebug
fi

exec "${GRADLE_BIN}" --no-daemon --stacktrace -p "${PROJECT_DIR}" "$@"
