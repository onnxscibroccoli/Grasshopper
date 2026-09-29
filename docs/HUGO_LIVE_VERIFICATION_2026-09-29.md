# Hugo Live Architecture Verification
**Timestamp:** 2026-09-29T20:03:10Z

## Verified live path

CloudFront HTTPS -> nginx :80 -> Helix gateway / MCP bridge -> libvirt/QEMU -> `helix-omnikali` -> Kali GNU/Linux Rolling.

Evidence collected from the connected EC2 host through Remote Desktop Commander:

- Public `/health`: HTTP 200.
- Public `/auth/login`: HTTP 200.
- Public `/desktop/omnikali`: HTTP 302 to `/auth/login`.
- Public `/novnc/vnc.html`: HTTP 200.
- `helix-omnikali`: libvirt state `running`.
- QEMU guest agent `guest-ping`: successful.
- QEMU guest-exec hostname: `kali`.
- Guest `/etc/os-release`: Kali GNU/Linux Rolling, VERSION_ID=2026.3.
- Local MCP bridge `127.0.0.1:8094/health`: HTTP 200.
- Local MCP bridge `127.0.0.1:8094/mcp`: HTTP 401 with OAuth protected-resource metadata.
- Public `POST /mcp`: initially HTTP 404 because the active nginx config lacked the route.
- Source fix merged as Helix PR #26, restoring `/mcp -> 127.0.0.1:8094/mcp`.
- After live nginx reload, public `GET /mcp` and `POST /mcp`: HTTP 401 with the expected OAuth protected-resource challenge.
- Public `/health` remained HTTP 200 after the live nginx reload.

## Separate prototype boundary

K3s remains a separate prototype substrate. Current `omnikali-desktop` pods are not used as evidence that the protected Helix desktop path reaches the production Kali guest.

## Source integrity boundary

The live `/opt/helix` checkout was observed at:

`46ba4b71158a74db5ede97e300099370792ecff8`

The working tree is dirty with modified and untracked production files. Therefore clean-host reconstruction and immutable-release lineage remain **NOT_PROVEN** even though the live runtime checks above pass.

## MCP edge incident

The missing active nginx `/mcp` route was a concrete edge regression. The MCP service itself was healthy. The fix was first committed, CI-validated, and merged in Helix PR #26 before the equivalent live nginx route was applied. A timestamped pre-change nginx backup was created on the host.

No authentication bypass was introduced.
