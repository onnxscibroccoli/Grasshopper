# OCI ARM64 workstation infrastructure
This directory is a sanitized declarative export of the live Grasshopper OCI workstation.
The production host remains Oracle Linux 9 ARM64. No OS conversion is performed.

## Live baseline
- OCI VM.Standard.A1.Flex
- aarch64
- 2 OCPU
- 12 GiB RAM
- Cloud Android QEMU remains a protected workload
- Nginx fronts the existing noVNC path
- Cloudflare Quick Tunnels currently expose the desktop services
- MCP is designed to bind only to loopback

No secrets, tokens, private keys, TLS private material, Cloudflare credentials, public IP addresses, or personal contact data belong in this tree.
