# Architecture boundaries

Grasshopper now treats three concerns as separate layers:

| Layer | Canonical location | Owns |
| --- | --- | --- |
| Core | core/ plus reusable runtime contracts in src/ | domain state, contracts, environment detection |
| Deployment | deploy/, infra/, deployment scripts | provider/host mechanics, lifecycle, packaging |
| Environment | environments/ | parameters and capabilities for the execution context |

src/ is retained during the migration because it is the validated compatibility implementation. Agents must not mass-move it without tests proving import, CLI, and production-contract compatibility.

## Migration rule

New functionality is placed in the correct layer first. Existing files move only when a compatibility wrapper can preserve the old path and the complete relevant test suite passes.

## Active environment

Agents call src/environment/detect.mjs to resolve the execution context. Explicit configuration and persisted markers override runtime heuristics. Runtime heuristics are fail-safe and never infer credentials.

## Release rule

The package version is SemVer. Release tags use vMAJOR.MINOR.PATCH. Major versions are immutable architecture milestones. The release workflow validates the exact tagged commit before creating the tag; no agent may retag an existing version.
