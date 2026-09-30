#!/usr/bin/env bash
set -Eeuo pipefail

NAME="grasshopper-kali"
ROOT="/var/lib/grasshopper/kali"
HOME_DIR="${ROOT}/home"
VNC_DIR="${ROOT}/vnc"
CONTAINER_PORT="5901"
HOST_VNC_PORT="${GRASSHOPPER_KALI_VNC_PORT:-5902}"
NOVNC_PORT="${GRASSHOPPER_NOVNC_PORT:-6080}"
IMAGE="docker.io/kalilinux/kali-rolling:arm64"
BASE="${HOME}/.grasshopper"
CONTAINERFILE="${BASE}/kali-rolling.Containerfile"
ENTRYPOINT="${BASE}/kali-entrypoint.sh"
VNC_PASS="${VNC_DIR}/passwd"

if [[ $(id -u) -ne 0 ]]; then
  echo "This bootstrap needs root privileges. Re-run it with sudo."
  exit 2
fi

command -v podman >/dev/null 2>&1 || dnf -y install podman
install -d -m 0750 "${ROOT}" "${HOME_DIR}" "${VNC_DIR}" "${BASE}"
chmod 0750 "${ROOT}" "${VNC_DIR}"

cat > "${CONTAINERFILE}" <<'CONTAINERFILE'
FROM docker.io/kalilinux/kali-rolling:arm64
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \\
 && apt-get install -y --no-install-recommends \\
      xfce4 xfce4-terminal thunar xfce4-panel xfdesktop xfwm4 xfconf \\
      xfce4-settings dbus-x11 xterm firefox-esr \\
      tigervnc-standalone-server tigervnc-tools sudo ca-certificates \\
      curl wget git vim tmux procps iproute2 iputils-ping \\
 && apt-get clean \\
 && rm -rf /var/lib/apt/lists/*
RUN useradd -m -s /bin/bash kali \\
 && usermod -aG sudo kali \\
 && printf 'kali ALL=(ALL) NOPASSWD:ALL\\n' > /etc/sudoers.d/kali \\
 && chmod 0440 /etc/sudoers.d/kali
COPY kali-entrypoint.sh /usr/local/bin/kali-entrypoint.sh
RUN chmod 0755 /usr/local/bin/kali-entrypoint.sh
WORKDIR /home/kali
ENTRYPOINT ["/usr/local/bin/kali-entrypoint.sh"]
CONTAINERFILE

cat > "${ENTRYPOINT}" <<'ENTRYPOINT'
#!/usr/bin/env bash
set -Eeuo pipefail
install -d -m 0700 -o kali -g kali /home/kali/.vnc
cat > /home/kali/.vnc/xstartup <<'XSTARTUP'
#!/bin/sh
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
exec dbus-run-session -- startxfce4
XSTARTUP
chmod 0755 /home/kali/.vnc/xstartup
exec su - kali -c 'vncserver :1 -fg -geometry 1920x1080 -depth 24 -localhost no -SecurityTypes VncAuth -rfbauth /run/grasshopper/vnc-passwd'
ENTRYPOINT
chmod 0755 "${ENTRYPOINT}"

echo "Pulling official Kali Rolling ARM64 image..."
podman pull "${IMAGE}"
echo "Building Grasshopper Kali desktop image..."
podman build --pull=never -t grasshopper/kali-rolling:desktop -f "${CONTAINERFILE}" "${BASE}"

if [[ ! -s "${VNC_PASS}" ]]; then
  umask 077
  printf '%s\n' "$(openssl rand -hex 16)" | podman run --rm -i grasshopper/kali-rolling:desktop vncpasswd -f > "${VNC_PASS}"
fi
chmod 0600 "${VNC_PASS}"

if podman container exists "${NAME}"; then
  podman rm -f "${NAME}" >/dev/null 2>&1 || true
fi

podman create \\
  --name "${NAME}" \\
  --hostname kali-workstation \\
  --publish "127.0.0.1:${HOST_VNC_PORT}:${CONTAINER_PORT}" \\
  --volume "${HOME_DIR}:/home/kali:Z" \\
  --volume "${VNC_PASS}:/run/grasshopper/vnc-passwd:ro,Z" \\
  --cap-drop=ALL \\
  --cap-add=SETUID \\
  --cap-add=SETGID \\
  --security-opt=no-new-privileges \\
  --pids-limit=1024 \\
  grasshopper/kali-rolling:desktop

cat > /etc/systemd/system/grasshopper-kali.service <<UNIT
[Unit]
Description=Grasshopper persistent Kali Rolling workstation
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
ExecStart=/usr/bin/podman start -a ${NAME}
ExecStop=/usr/bin/podman stop -t 15 ${NAME}
Restart=always
RestartSec=5
TimeoutStartSec=0
NoNewPrivileges=true
[Install]
WantedBy=multi-user.target
UNIT

systemctl disable --now grasshopper-vnc.service 2>/dev/null || true
systemctl daemon-reload
systemctl enable --now grasshopper-kali.service

for i in $(seq 1 60); do
  if ss -lnt | grep -q "127.0.0.1:${HOST_VNC_PORT}"; then break; fi
  sleep 2
done
ss -lnt | grep -q "127.0.0.1:${HOST_VNC_PORT}" || {
  journalctl -u grasshopper-kali.service --no-pager -n 100
  exit 7
}

systemctl disable --now grasshopper-novnc.service 2>/dev/null || true
cat > /etc/systemd/system/grasshopper-novnc.service <<UNIT
[Unit]
Description=Grasshopper noVNC proxy for Kali Rolling
After=network-online.target grasshopper-kali.service
Requires=grasshopper-kali.service
[Service]
Type=simple
ExecStart=/opt/noVNC/utils/novnc_proxy --listen 127.0.0.1:${NOVNC_PORT} --vnc 127.0.0.1:${HOST_VNC_PORT}
Restart=always
RestartSec=3
NoNewPrivileges=true
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now grasshopper-novnc.service

for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${NOVNC_PORT}/vnc.html" >/dev/null; then break; fi
  sleep 2
done
curl -fsS "http://127.0.0.1:${NOVNC_PORT}/vnc.html" >/dev/null

echo "=== KALI ROLLING WORKSTATION READY ==="
podman exec "${NAME}" bash -lc 'cat /etc/os-release | grep -E "^(PRETTY_NAME|VERSION_CODENAME)="; printf "arch="; dpkg --print-architecture; printf "desktop="; pgrep -a xfce4-session || true'
echo "VNC=127.0.0.1:${HOST_VNC_PORT}"
echo "NOVNC=http://127.0.0.1:${NOVNC_PORT}/vnc.html"
echo "PERSISTENT_HOME=${HOME_DIR}"
