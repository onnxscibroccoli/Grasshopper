# Live paths 2026-09-29

Grasshopper reconstructs the validated Helix production path. It is not allowed to replace that path with Kubernetes ingress.

## Current production (Helix)

```
Internet → CloudFront https://d22bad48irrbqe.cloudfront.net
  → nginx :80 → Helix :8092 → libvirt/QEMU → helix-omnikali
```

- Product login: `/auth/login`
- Intentional hypervisor console: `/novnc/vnc.html` (Debian host :5900)

## Prototype only

K3s `omnikali-desktop` on the same EC2 host. Local NodePorts. Not CloudFront origin.

Issue #62: Traefik bound 80/443 and broke production. Do not repeat.

Issue #64: K3s live desktop acceptance stays a prototype gate, not a cutover gate.
