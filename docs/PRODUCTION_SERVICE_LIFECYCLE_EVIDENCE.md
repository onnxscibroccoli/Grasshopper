# Production Service Lifecycle Evidence

Source repository: `onnxscibroccoli/helix`

Source revision: `38903b021cca75189a99e1ed88b508bae577f048`

The accepted source revision contains a gateway systemd unit at:

`production/gateway/helix-gateway.service`

Its declared lifecycle is:

- service identity: `helix-gateway`
- manager: systemd
- working directory: `/opt/helix`
- protected runtime environment: `/etc/helix/gateway.env`
- start command: `/bin/sh /opt/helix/production/gateway/start-helix-gateway.sh`
- restart policy: always
- restart delay: 3 seconds
- startup dependency: `helix-libvirt-hypervisor.service`
- readiness is separate from systemd process state

The source revision also contains another gateway unit at:

`production/systemd/helix-gateway.service`

That second unit uses a different filesystem layout and service account. Its presence means source inspection alone does not establish which unit was actually deployed.

Therefore Grasshopper records the first unit as **source evidence**, not as the deployed lifecycle definition. The exact deployed unit, enabled target, effective environment binding, and worker lifecycle must still be recovered from authoritative runtime evidence.

The gateway source at the accepted revision initializes the task worker from the gateway startup callback. This means the verified task worker is part of the gateway service lifecycle rather than a separately established worker service in the recovered source.

Security requirements remain:

- do not copy credential values into this repository;
- preserve protected runtime configuration;
- resolve secrets through the authorized runtime mechanism;
- do not treat a source service file as proof of deployment identity;
- do not weaken the validated authenticated gateway boundary.

See `docs/SERVICE_LIFECYCLE_CONTRACT.md` and `docs/AUTHORITATIVE_SOURCE_RECOVERY.md`.
