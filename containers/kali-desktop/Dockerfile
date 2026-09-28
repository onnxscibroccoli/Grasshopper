FROM kalilinux/kali-rolling

ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=:1

RUN apt-get update && apt-get install -y --no-install-recommends \
    xfce4 xfce4-terminal firefox-esr dbus-x11 x11vnc novnc websockify supervisor \
    ca-certificates curl sudo procps iproute2 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash kali && \
    echo 'kali ALL=(ALL) NOPASSWD:ALL' >/etc/sudoers.d/kali && \
    chmod 0440 /etc/sudoers.d/kali && \
    mkdir -p /home/kali/.vnc /run/user/1000 && \
    chown -R kali:kali /home/kali /run/user/1000

COPY supervisord.conf /etc/supervisor/conf.d/omnikali.conf
COPY start-desktop.sh /usr/local/bin/start-desktop.sh
COPY vnc-start.sh /usr/local/bin/omnikali-vnc
RUN chmod 0755 /usr/local/bin/start-desktop.sh /usr/local/bin/omnikali-vnc

EXPOSE 6080
USER root
ENTRYPOINT ["/usr/local/bin/start-desktop.sh"]
