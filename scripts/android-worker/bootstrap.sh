#!/usr/bin/env bash
# Dedicated disposable worker only. Never run on the Helix production base.
set -euo pipefail
[[ "${EUID}" == 0 ]] || { echo "Run as root" >&2; exit 1; }
[[ -f /etc/grasshopper-android-worker ]] || { echo "Worker marker missing" >&2; exit 1; }
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y openjdk-17-jre-headless unzip curl python3 libgl1 libpulse0 libnss3 libx11-6 libxcb1 libxcomposite1 libxcursor1 libxi6 libxtst6 libxrandr2 libasound2t64 libxkbcommon-x11-0 xvfb x11vnc novnc websockify fluxbox nftables xauth openssl libxcb-cursor0
modprobe kvm_intel
python3 - <<'PY'
import os,fcntl
fd=os.open('/dev/kvm',os.O_RDWR)
assert fcntl.ioctl(fd,0xae00,0)==12, 'KVM API unavailable'
os.close(fd)
PY
install -d /opt/android-sdk/cmdline-tools /var/lib/grasshopper-android/evidence
if [[ ! -x /opt/android-sdk/cmdline-tools/current/bin/sdkmanager ]]; then
  curl --fail --location --retry 3 https://dl.google.com/android/repository/commandlinetools-linux-15859902_latest.zip -o /tmp/android-cli.zip
  echo '4e4c464f145a7512b57d088ac6c278c03c9eea610886b35a5e0804e74eedf583  /tmp/android-cli.zip' | sha256sum -c -
  unzip -q /tmp/android-cli.zip -d /opt/android-sdk/cmdline-tools
  mv /opt/android-sdk/cmdline-tools/cmdline-tools /opt/android-sdk/cmdline-tools/current
  # Retain installer until acceptance for diagnosis.
fi
export ANDROID_HOME=/opt/android-sdk
SDK=/opt/android-sdk/cmdline-tools/current/bin
# SDK licenses are part of this authorized development installation.
set +o pipefail
yes | "$SDK/sdkmanager" --sdk_root="$ANDROID_HOME" --licenses > /var/lib/grasshopper-android/sdk-licenses.log
rc=${PIPESTATUS[1]}
set -o pipefail
[[ "$rc" == 0 ]]
"$SDK/sdkmanager" --sdk_root="$ANDROID_HOME" 'platform-tools' 'emulator' 'system-images;android-35;google_apis_playstore;x86_64' 'system-images;android-35;default;x86_64'
chmod -R go-w /opt/android-sdk
for role in companion dev; do
  id "android-$role" >/dev/null 2>&1 || useradd --create-home --shell /bin/bash "android-$role"
  usermod -aG kvm "android-$role"
  chmod 700 "/home/android-$role"
  if [[ "$role" == companion ]]; then image=google_apis_playstore; port=5554; display=10; vnc=5910; web=6080; else image=default; port=5556; display=11; vnc=5911; web=6081; fi
  if [[ ! -f "/home/android-$role/.android/avd/$role.ini" ]]; then
    printf 'no\n' | runuser -u "android-$role" -- env ANDROID_HOME="$ANDROID_HOME" "$SDK/avdmanager" create avd --name "$role" --package "system-images;android-35;$image;x86_64" --device pixel_2
    cat >> "/home/android-$role/.android/avd/$role.avd/config.ini" <<'AVD'
hw.lcd.width=1080
hw.lcd.height=2408
hw.lcd.density=400
hw.ramSize=3072
hw.cpu.ncore=2
disk.dataPartition.size=8G
showDeviceFrame=no
hw.keyboard=yes
AVD
    chown -R "android-$role:android-$role" "/home/android-$role/.android"
  fi
  if [[ ! -f "/home/android-$role/.Xauthority" ]]; then
    runuser -u "android-$role" -- xauth -f "/home/android-$role/.Xauthority" add ":$display" . "$(openssl rand -hex 16)"
  fi
  cat > "/etc/systemd/system/android-display-$role.service" <<UNIT
[Unit]
Description=Private Android display $role
[Service]
User=android-$role
ExecStart=/usr/bin/Xvfb :$display -screen 0 1100x2500x24 -nolisten tcp -auth /home/android-$role/.Xauthority
Restart=on-failure
RestartSec=10
[Install]
WantedBy=multi-user.target
UNIT
  cat > "/etc/systemd/system/android-$role.service" <<UNIT
[Unit]
Description=Android 15 $role emulator
Requires=android-display-$role.service
After=android-display-$role.service network-online.target
StartLimitIntervalSec=600
StartLimitBurst=3
[Service]
User=android-$role
Environment=HOME=/home/android-$role
Environment=ANDROID_HOME=/opt/android-sdk
Environment=DISPLAY=:$display
Environment=QT_X11_NO_MITSHM=1
ExecStart=/opt/android-sdk/emulator/emulator -avd $role -port $port -accel on -gpu swiftshader_indirect -no-audio -no-boot-anim -no-snapshot -camera-back none -camera-front none -no-metrics
Restart=on-failure
RestartSec=20
TimeoutStopSec=90
KillSignal=SIGTERM
UMask=0077
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/home/android-$role /tmp
ProtectKernelTunables=true
ProtectControlGroups=true
[Install]
WantedBy=multi-user.target
UNIT
  cat > "/etc/systemd/system/android-vnc-$role.service" <<UNIT
[Unit]
Description=Loopback VNC for Android $role
Requires=android-display-$role.service
After=android-display-$role.service
[Service]
User=android-$role
ExecStart=/usr/bin/x11vnc -display :$display -auth /home/android-$role/.Xauthority -localhost -rfbport $vnc -forever -shared -nopw -noxdamage
Restart=on-failure
RestartSec=10
[Install]
WantedBy=multi-user.target
UNIT
  cat > "/etc/systemd/system/android-web-$role.service" <<UNIT
[Unit]
Description=Private noVNC for Android $role via SSM only
After=android-vnc-$role.service
[Service]
User=android-$role
ExecStart=/usr/bin/websockify --web=/usr/share/novnc 127.0.0.1:$web 127.0.0.1:$vnc
Restart=on-failure
RestartSec=10
[Install]
WantedBy=multi-user.target
UNIT
done
# Keep emulator processes from reaching instance credentials or other private hosts.
# Block cross-instance emulator control connections; root/SSM operator is unaffected.
cat > /etc/nftables.conf <<'NFT'
#!/usr/sbin/nft -f
flush ruleset
table inet android_guard {
 chain output {
  type filter hook output priority 0; policy accept;
  meta skuid { "android-companion", "android-dev" } ip daddr { 169.254.0.0/16, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 } reject
  meta skuid { "android-companion", "android-dev" } ip6 daddr { fe80::/10, fc00::/7 } reject
  meta skuid "android-companion" tcp dport { 5556, 5557, 5911, 6081 } reject
  meta skuid "android-dev" tcp dport { 5554, 5555, 5910, 6080 } reject
 }
}
NFT
nft --check -f /etc/nftables.conf
systemctl enable --now nftables
systemctl daemon-reload
for role in companion dev; do
  systemctl enable --now "android-display-$role" "android-$role" "android-vnc-$role" "android-web-$role"
done
/opt/android-sdk/emulator/emulator -accel-check
"$SDK/sdkmanager" --sdk_root="$ANDROID_HOME" --list_installed > /var/lib/grasshopper-android/packages.txt
echo ANDROID_INSTALL_COMPLETE_ACCEPTANCE_PENDING

