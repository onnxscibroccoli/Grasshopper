#!/usr/bin/env bash
# Live desktop Google ADC + OCI OAuth. Persistent menu: recover/retry after failures.
set -uo pipefail
umask 077
export HOME=/home/grasshopper
export DISPLAY=:1
export XAUTHORITY=/home/grasshopper/.Xauthority
export BROWSER=/usr/bin/firefox
export CLOUDSDK_CORE_DISABLE_PROMPTS=0
export PYTHONUNBUFFERED=1
# Graphical desktop DBus session needed to open a tab in existing session.
if [[ -z "${DBUS_SESSION_BUS_ADDRESS:-}" ]]; then
  DBUS_SESSION_BUS_ADDRESS="$(python3 - <<'PY'
from pathlib import Path
import os
uid=os.getuid()
for p in sorted(Path('/proc').glob('[0-9]*/cmdline')):
 try:
  pid=p.parent.name
  if Path('/proc/'+pid).stat().st_uid != uid:continue
  raw=p.read_bytes().replace(b'\0',b' ')
  if b'xfce4-session' not in raw or b'python' in raw:continue
  for item in Path('/proc/'+pid+'/environ').read_bytes().split(b'\0'):
   if item.startswith(b'DBUS_SESSION_BUS_ADDRESS='):
    print(item.split(b'=',1)[1].decode());raise SystemExit
 except (OSError,PermissionError):continue
PY
)"
  export DBUS_SESSION_BUS_ADDRESS
fi
PROFILE=OMNIKALI
REGION=us-ashburn-1
PROJECT=omnikali
ROOT="$HOME/.local/state/grasshopper-cloud-auth"
mkdir -p "$ROOT"
chmod 700 "$ROOT"
STEP=0
phase() { STEP=$((STEP+1)); printf '\n[STEP %d | %s] %s\n' "$STEP" "$(date '+%H:%M:%S')" "$*"; }
log_status() { printf '%s %s\n' "$(date -Iseconds)" "$1" >> "$ROOT/browser-login-status.log"; }
gcloud_api() { timeout 30 gcloud projects describe "$PROJECT" --format='value(projectId)' --quiet >/dev/null 2>&1; }
adc_api() { timeout 17 gcloud auth application-default print-access-token --quiet >/dev/null 2>&1; }
oci_api() {
 timeout 10 oci session validate --local --auth security_token --profile "$PROFILE" >/dev/null 2>&1 &&
 timeout 35 oci iam availability-domain list --profile "$PROFILE" --auth security_token --region "$REGION" --no-retry >/dev/null 2>&1
}
status() {
 phase "Check current credentials (token contents hidden)"
 if gcloud_api; then echo "GOOGLE_CLI=PASS"; else echo "GOOGLE_CLI=FAIL"; fi
 if adc_api; then echo "GOOGLE_ADC=PASS"; else echo "GOOGLE_ADC=NEEDS_LOGIN"; fi
 if oci_api; then echo "OCI_OMNIKALI=PASS"; else echo "OCI_OMNIKALI=NEEDS_LOGIN"; fi
}
google() {
 phase "Google Cloud browser OAuth"
 if ! gcloud_api; then
   echo 'Google CLI login via Firefox; complete browser login on this desktop.'
   if ! gcloud auth login; then log_status 'GOOGLE_CLI_FAILED'; return 1; fi
 fi
 if adc_api; then echo 'Google ADC already works.';log_status 'GOOGLE_ADC_PASS';return 0;fi
 echo 'Firefox should open for Google ADC. Complete sign-in in the browser.'
 echo "Quota project: $PROJECT (API usage can be billed)."
 local adc="$HOME/.config/gcloud/application_default_credentials.json"
 if [[ -e "$adc" ]]; then
    cp -p "$adc" "$ROOT/adc-before-$(date +%Y%m%d-%H%M%S).json" || return 1
 fi
 if ! gcloud auth application-default login --project="$PROJECT"; then
   echo 'Google OAuth not finished. Press 1 to retry. Window stays open.'
   log_status 'GOOGLE_ADC_LOGIN_FAILED';return 1
 fi
 if adc_api; then
   echo 'PASS: Google ADC refresh verified.'
   log_status 'GOOGLE_ADC_PASS';return 0
 fi
 echo 'ADC not validated; can retry without closing this window.'
 log_status 'GOOGLE_ADC_API_FAILED';return 1
}
oracle() {
 phase "Oracle OCI browser OAuth"
 if oci_api; then
   echo 'PASS: existing OCI session valid.';log_status 'OCI_SESSION_PASS';return 0
 fi
 local backup="$ROOT/oci-before-$(date +%Y%m%d-%H%M%S)"
 mkdir -p "$backup"
 cp -a "$HOME/.oci" "$backup/" || { echo 'Backup failed, preserving current config';return 1; }
 echo "Opening Oracle browser login for existing $PROFILE profile."
 echo 'Complete Oracle SSO in Firefox; the CLI callback is on this workstation.'
 if ! oci session authenticate --region "$REGION" --profile-name "$PROFILE" --config-location "$HOME/.oci/config";then
    echo 'Oracle OAuth not finished. Press 2 to retry. Window stays open.'
    log_status 'OCI_SESSION_LOGIN_FAILED';return 1
 fi
 if oci_api; then
   echo 'PASS: signed OCI API request verified.'
   log_status 'OCI_SESSION_PASS';return 0
 fi
 echo 'OCI signed API not validated. Press 2 to retry.'
 log_status 'OCI_SESSION_API_FAILED';return 1
}
echo '======================================================'
echo ' Grasshopper • Cloud Development OAuth (desktop UI)'
echo ' Google Cloud SDK + Oracle OCI CLI, existing installs'
echo ' This terminal STAYS OPEN on errors/retries.'
echo ' No VNC/password/server changes. No package installs.'
echo '======================================================'
echo "Browser display: $DISPLAY | Oracle profile: $PROFILE"
echo 'For HTTPS viewing, use only an address that WORKS on your phone.'
echo 'Do not paste OAuth tokens or full callback URLs into ChatGPT.'
status
# Automatic sequential browser OAuth on first launch, keeping menu afterwards.
if ! google; then
 echo 'Google ADC pending. Browser login can be retried from the menu.'
else
 if ! oracle; then echo 'OCI pending; retry with option 2.';fi
fi
while :; do
  echo
  echo '------------------------------------------------------'
  echo '1) Google CLI + ADC (browser OAuth)'
  echo '2) OCI OMNIKALI (browser OAuth)'
  echo '3) Recheck Google + OCI APIs'
  echo '4) Run both / retry'
  echo '5) Open Firefox'
  echo '0) Exit this window'
  read -r -p 'Choose [0-5]: ' choice || choice=3
  case "$choice" in
    1) google || :;;
    2) oracle || :;;
    3) status;;
    4) google && oracle || :;;
    5) /usr/bin/firefox --new-window about:blank >/dev/null 2>&1 &;;
    0) echo 'Finished; authentication configuration retained.';exit 0;;
    *) echo 'Unknown option, try 1-5.';;
  esac
done
