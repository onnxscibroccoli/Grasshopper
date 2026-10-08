# Grasshopper agent coordination

Before modifying a shared runtime, inspect current branches and open pull requests and read docs/AGENT_COORDINATION.md.

For Cloud Android:
- Native ARM64 OCI is the active new-runtime lead.
- Extend or stack on the active ARM64 PR. Do not create a competing launcher.
- A running guest/container is a live acceptance boundary. Never remove or restart it just to obtain cleaner evidence.
- Use disposable state directories, containers, ports, and guest disks for experiments.
- The legacy Android-x86 runtime is a behavioral benchmark, not the active ARM64 implementation.
- AWS Helix/Kali is protected and must remain untouched unless an explicit migration is authorized.
- Preserve exact evidence and hand off the current commit, blocker, next test, and state paths.

A failed test is evidence. Do not weaken or delete it to make CI green.

The objective is convergence and verified capability, not branch count.
