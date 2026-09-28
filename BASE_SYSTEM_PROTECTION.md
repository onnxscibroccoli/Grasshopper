# Base System Protection

## Non-negotiable boundary

The existing OmniKali/Helix remote Kali system is the **validated base system and reference prototype**.

It is not disposable infrastructure for experiments.

New prototypes, including K3s/Kubernetes, multi-cloud, OKE, GKE, AKS, alternate ingress, or portability experiments, must be isolated from the base system unless an explicit migration is approved.

## Known-good public invariants

Before and after prototype work, verify:

- https://d22bad48irrbqe.cloudfront.net/health returns HTTP 200.
- https://d22bad48irrbqe.cloudfront.net/auth/login renders the OmniKali sign-in page.
- https://d22bad48irrbqe.cloudfront.net/desktop/omnikali reaches the authenticated desktop route.
- https://d22bad48irrbqe.cloudfront.net/novnc/vnc.html loads the noVNC interface.

A healthy prototype does not compensate for a broken base system. If any invariant fails, stop prototype deployment and restore the base system first.

## Protected architecture

The validated path is:

CloudFront
-> host 80/443
-> nginx
-> Helix gateway
-> authentication
-> desktop/noVNC
-> Kali workload

Do not replace or intercept this path with prototype infrastructure.

## Required networking preflight

Before deploying anything onto the base host:

1. Record listeners:
   `ss -lntp`
2. Record host NAT/forwarding:
   `iptables -t nat -S`
   `nft list ruleset`
3. Record nginx configuration and service state.
4. Determine every host port the prototype will claim.
5. Reject any host-port collision.
6. Prefer a separate VM, node, host, or provider for prototype ingress.
7. Do not use `hostNetwork`, `hostPort`, privileged networking, or host-level DNAT on the base host without an explicit compatibility review.
8. Preserve a rollback point before changing host networking.
9. Test the public CloudFront health endpoint immediately after networking changes.

## Incident record: 2026-09-28

The K3s prototype caused an outage of the public base system.

K3s installed its bundled Traefik ingress. Its `svclb-traefik` component captured host ports 80/443 and DNATed traffic to Traefik. The existing nginx -> Helix path therefore stopped receiving CloudFront traffic.

The public CloudFront URL returned 404 while the Helix gateway itself remained healthy on its internal listener.

Recovery was achieved by disabling the bundled K3s Traefik component and restoring the existing nginx -> Helix edge path. The Kubernetes desktop workloads and their PVCs were preserved.

Full incident record:

https://github.com/onnxscibroccoli/Grasshopper/issues/62

## Agent rule

**Do not take out the base system to prove a prototype.**

The prototype must prove portability, recovery, isolation, and deployment without sacrificing the known-good remote Kali system.

If the only way to deploy the prototype is to take over the base system's ingress or host networking, the correct action is to create an isolated environment instead.
