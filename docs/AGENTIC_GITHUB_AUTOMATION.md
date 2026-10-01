# Agentic GitHub automation

**Status:** DEV_SANDBOX integration work, 2026-10-01.

Grasshopper now has two complementary agent paths:

1. GitHub Actions provides the repository-side recurring verification and bounded coding loop.
2. OpenClaw provides the persistent OCI development-side agent workstation.

## Current GitHub Actions baseline

The repository already contains:

- `.github/workflows/agentic-development-loop.yml` for recurring verification and bounded improvement;
- `.github/workflows/agentic-control-plane.yml` for clean-source control-plane reproduction;
- `.github/workflows/agentic-reproducibility.yml` for reproducibility checks;
- `.github/workflows/bist.yml` for BIST validation;
- `.github/workflows/overnight-chain.yml` for bounded scheduled follow-on checks;
- `.github/workflows/security-phase-contract.yml` for the DEV_SANDBOX/STAGING/PROD_CANDIDATE/PROD phase contract.

The autonomous GitHub Actions job is intentionally bounded. It may create a PR, but it must not merge, mutate production infrastructure, use production credentials, or bypass verification.

## OpenClaw GitHub integration

The OCI workstation has OpenClaw 2026.9.7 and is configured with GitHub's hosted MCP endpoint:

`https://api.githubcopilot.com/mcp/`

The configured toolsets are:

- `actions`
- `repos`
- `pull_requests`
- `issues`

This is intended to let the development agent inspect repositories, inspect and trigger Actions, modify repository content, and create/update PRs once GitHub authorization is completed.

The workstation does **not** store a GitHub PAT in repository configuration.

### Current authorization state

The MCP server configuration is present, but OpenClaw authorization is not yet complete. The hosted GitHub MCP OAuth endpoint currently rejects OpenClaw's dynamic-client-registration flow. Do not work around this by placing a token in `openclaw.json`.

The remaining operator boundary is GitHub account authorization. Once an approved authentication path is available, verify:

1. OpenClaw can list `onnxscibroccoli/Grasshopper`.
2. OpenClaw can read workflow state.
3. OpenClaw can dispatch a disposable development workflow.
4. OpenClaw can create a branch and PR.
5. OpenClaw cannot merge or mutate production infrastructure unless that authority is explicitly granted later.

## Development operating model

The intended loop is:

`observe -> backup -> inspect -> change -> test -> record -> continue`

Development remains permissive and accessible. Backup and recovery are the primary safety net inside the isolated DEV_SANDBOX. Production remains outside the workstation trust boundary and is governed by the security-phase promotion contract.

## Documentation maintenance

Dated evidence documents are historical records and must not be rewritten merely to make their timestamps current.

Current pointer documents such as READMEs, current architecture summaries, and operational indexes should be refreshed when the architecture materially changes.

`scripts/verify-doc-freshness.mjs` checks the repository's current README snapshot date and fails when it is older than the configured freshness window. It deliberately does not rewrite historical evidence.

