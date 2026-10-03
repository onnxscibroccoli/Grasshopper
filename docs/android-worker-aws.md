# AWS Android Workers
## Current deployment
- Region: us-east-1
- Companion: m7i-flex.large, Android 15 API 35, non-root adbd
- Development: m7i-flex.large, Android 15 API 35, userdebug/root adbd
- Nested virtualization: enabled
- Root volume: 60 GiB encrypted gp3 per worker
- Network: dedicated security group with no inbound rules
- Management: AWS Systems Manager only, no SSH ingress
- ADB: loopback-only worker port 5038
- Emulator serials: companion 127.0.0.1:5555, dev 127.0.0.1:5557
## Acceptance
Both workers passed grasshopper.android-worker/v1 before host reboot:
- API level 35
- expected root state
- build fingerprint
- SELinux enforcing
- UI hierarchy pull
- PNG framebuffer capture
- persistent userdata marker
## Reproducibility
The verifier fix is committed on feat/isolated-android-worker at 052a695884e96e69d61a0135f7a3a067d1b44aa9.
The AWS bootstrap should be pinned to a commit SHA for future rebuilds instead of a moving branch URL.
## Follow-up
The EC2 reboot was intentionally used as the next persistence gate. EC2 and SSM returned healthy after reboot, but the post-reboot Android-service/marker check was delayed by stale SSM command execution and is therefore NOT_PROVEN until rerun.
