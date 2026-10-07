# Deployment boundary

Core policy belongs in `core/`; environment parameters belong in
`config/environments/`. Existing deployment entrypoints remain under `scripts/`
for compatibility while they are migrated individually with tests. The first
module moved is cloud Android memory admission; its old import re-exports the
same implementation. This change does not claim a complete repository move.

Run `node bin/environment.mjs` from any working directory. It probes local
Android properties or OCI metadata with bounded timeouts, then loads a profile.
Unknown or contradictory evidence exits 78 without selecting a transport.
Physical detection requires an explicit non-QEMU property; phones omitting it
remain unknown pending a separately verified identity adapter. This collector
has not yet been live-qualified on the offline physical phone.
Profiles describe intended control directions; detection never grants access or
executes actions. Local metadata identity is not an OCI IAM authorization check.

Phone-to-cloud and workstation-to-cloud control require separately authenticated
adapters and fresh target-bound input/reconnect artifacts. The phone is currently
offline and cloud Android R2 remains unverified; neither direction is promoted by
these configuration files. Cloud Android need not install Node: its host adapter
can collect properties and pass observations to the pure classifier. A guest-side
collector and full bidirectional acceptance are subsequent contracts.

## Clean rebuild and rollback

Use a new checkout and a new development state directory; never wipe the working
cloud chat or overwrite an existing guest disk. Benchmark against source
`fdbd7f244be8094571f8a9426b8c2ccd9b01b259` and the recorded legacy acceptance
artifacts, distinguishing source regression tests from live device acceptance.
Run `npm test` and the degradation guard before runtime changes. Rebuild the
development image from its pinned Containerfile only after CPU/memory admission.
The current software-rendering CPU saturation must be resolved before a new
interactive acceptance run. A production rollout requires exact-commit CI and
the full live contract; failure restores the previously verified deployment and
its independent persistent data. Reverting this additive source commit restores
the former module layout without changing a running guest.

## Releases

The package version follows SemVer: patch for compatible fixes, minor for
compatible capabilities, major for incompatible contracts. Pre-release versions
identify unaccepted development work. For each accepted release, create an
annotated immutable Git tag `v<package version>` on the exact tested commit and
record source, image digest, environment, recovery point and acceptance artifacts.
Never move a published tag. A major release requires a migration and rollback
document. No major release or production tag is created by this contract because
live R2 and production-contract acceptance remain pending.
