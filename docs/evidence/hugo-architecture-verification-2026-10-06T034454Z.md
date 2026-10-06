# Hugo architecture verification

UTC timestamp: 2026-10-06T03:44:54Z

Status: FAIL-CLOSED.

Fresh live host evidence from ip-172-31-8-59: nginx active on 0.0.0.0:80; Helix active on 127.0.0.1:8092; libvirt active; helix-omnikali running, persistent, autostart enabled; QEMU guest RFB 127.0.0.1:5901; x11vnc 127.0.0.1:5900; websockify 127.0.0.1:6080. No local listener observed on 443, 6443, 30080, 30081, or 7000. No Traefik or FRP process observed.

Kubernetes prototype: K3s inactive, Kubernetes API not listening, NodePorts not listening. This does not replace the protected production path.

Live /opt/helix SHA: 46ba4b71158a74db5ede97e300099370792ecff8. The checkout is dirty and differs from GitHub main, so source reproducibility remains a blocker.

Current GitHub main SHA for Grasshopper: b5dd3a3dacc8cbd96b124c9b7e4cc59bc4af1768.

AWS account-wide inventory: NOT VERIFIED. The AWS connector required interactive account-link selection during this non-interactive run, so the AWS API inventory did not execute. Therefore IAM permission completeness is not claimed either way. No secrets were accessed.

Public CloudFront and authenticated end-to-end acceptance: NOT VERIFIED in this run. Task execution: NOT RUN.

No production mutation, merge, ingress installation, listener installation, or destructive recovery performed.
