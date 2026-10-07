#!/system/bin/sh
# Opt-in network for the pinned Android-x86 image on QEMU user networking.
# Preserve Android firewall and authentication; add a route below netd rules.
set -eu
NET_ROOT="${CLOUD_ANDROID_NET_ROOT:-/sys/class/net}"
ATTEMPTS="${CLOUD_ANDROID_NET_ATTEMPTS:-60}"
n=0
while [ "$n" -lt "$ATTEMPTS" ]; do
  for iface in wifi_eth eth0; do
    [ -r "$NET_ROOT/$iface/address" ] || continue
    [ "$(cat "$NET_ROOT/$iface/address")" = 52:54:00:12:34:56 ] || continue
    ip link set "$iface" up
    if ! ip -o -4 addr show dev "$iface" | grep -q 'inet 10.0.2.15/24'; then
      ip addr add 10.0.2.15/24 dev "$iface"
    fi
    ip route replace default via 10.0.2.2 dev "$iface"
    if ! ip rule show | grep -q '^18000:.*lookup main'; then
      ip rule add priority 18000 lookup main
    fi
    echo "CLOUD_NETWORK_READY iface=$iface address=10.0.2.15"
    exit 0
  done
  n=$((n + 1))
  sleep 2
done
echo "CLOUD_NETWORK_FAILED: matching QEMU NIC absent" >&2
exit 1
