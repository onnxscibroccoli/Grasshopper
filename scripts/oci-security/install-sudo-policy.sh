#!/usr/bin/env bash
set -Eeuo pipefail
[[ "$EUID" == 0 ]] || { echo "Run as root" >&2; exit 1; }
install -d -m 0755 /usr/local/libexec/grasshopper-oci-security
cat > /usr/local/libexec/grasshopper-oci-security/apply-security-updates <<'WRAP'
#!/usr/bin/env bash
set -Eeuo pipefail
exec /usr/bin/dnf -y update --security
WRAP
cat > /usr/local/libexec/grasshopper-oci-security/restart-fail2ban <<'WRAP'
#!/usr/bin/env bash
set -Eeuo pipefail
exec /usr/bin/systemctl restart fail2ban
WRAP
chmod 0755 /usr/local/libexec/grasshopper-oci-security/apply-security-updates /usr/local/libexec/grasshopper-oci-security/restart-fail2ban
chown root:root /usr/local/libexec/grasshopper-oci-security/apply-security-updates /usr/local/libexec/grasshopper-oci-security/restart-fail2ban
cat > /etc/sudoers.d/grasshopper-oci-security <<'SUDO'
grasshopper ALL=(root) NOPASSWD: /usr/local/libexec/grasshopper-oci-security/apply-security-updates, /usr/local/libexec/grasshopper-oci-security/restart-fail2ban
SUDO
chmod 0440 /etc/sudoers.d/grasshopper-oci-security
chown root:root /etc/sudoers.d/grasshopper-oci-security
/usr/sbin/visudo -cf /etc/sudoers.d/grasshopper-oci-security
echo OCI_SECURITY_SUDO_POLICY_READY
