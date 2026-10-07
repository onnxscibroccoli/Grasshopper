# Physical Android launcher policy — 2026-10-07

Physical Android automation must call the existing broccoli-core `lib/rish_run.sh`; `bin/broccoli-rish` delegates to that wrapper. Direct downloaded/raw `rish`, hard-coded driver commands and copied wrappers are retired as public automation launchers. The underlying Shizuku/Rish driver remains an internal core dependency.

From any working directory in Termux or a verified phone RDC shell:

```sh
BROCCOLI_ROOT="${BROCCOLI_ROOT:-$HOME/broccoli-core}"
RISH_PRESERVE_ENV=0 bash "$BROCCOLI_ROOT/lib/rish_run.sh" 'printf "BROCCOLI_RISH_OK\n"; id; getprop ro.build.version.sdk'
```

Core configuration owns `BROCCOLI_RISH_BIN` and `BROCCOLI_RISH_ENV`. Respect Shizuku authorization; errors 78/79 identify missing environment/driver prerequisites. Do not copy the wrapper into Grasshopper or add raw-driver fallback.

`android-lifecycle-audit.sh` reports wrapper **AVAILABLE** only when the canonical file is present/readable. It always leaves live transport health **NOT_PROVEN**: availability cannot prove authenticated execution, marker output, identity, artifact retrieval, application behavior or R2.

Remote Android remains customizable through its explicitly configured, verified transport (for example authenticated ADB on OCI). Physical Rish policy does not force the phone transport onto the cloud guest. Bind acceptance to repository commit, node, transport and fresh artifacts. Observing an event does not authorize command replay.

Dated transport records retain historical commands and evidence; their relative/raw examples do not supersede this current launcher policy. Proposed retirement pull requests are unmerged until exact-commit production-contract gates pass; an audit never establishes rollout by itself.

See [the versioned account audit](PHYSICAL_RISH_REPOSITORY_AUDIT_2026-10-07.md).
