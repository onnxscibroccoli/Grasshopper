# Overnight test chain

## Fact

Claude Code in the current Grok/Claude sandbox often has:

- no GitHub tool
- outbound network disabled

That session cannot `workflow_dispatch` anything. That is a session limit, not a GitHub outage.

## Who can dispatch

| Actor | Can dispatch Grasshopper workflows |
| --- | --- |
| GitHub Actions cron | yes, after this workflow is on `main` |
| `workflow_dispatch` from GitHub UI | yes |
| Grok session with GitHub connector | yes |
| Claude no-network sandbox | no |

## What runs

`.github/workflows/overnight-chain.yml` on the hour 00:00-08:00 America/New_York (EDT cron `0 4-12 * * *`):

1. `bist.yml`
2. `agentic-development-loop.yml` with `autonomous=true`
3. comment on issue #65

It does **not** run `k3s-live-desktop.yml` or bind 80/443.

Cross-repo helix/omnikali/KG dispatch is intentionally omitted. The default `GITHUB_TOKEN` cannot trigger other repositories. Those repos keep their own schedules (`omnikali` probe every 15 minutes; KG refresh weekly).

## Human merge authority

The agentic loop may open a PR. It must not merge `main`.
