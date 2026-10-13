# GitHub Actions — Best Immediate $0 Cross-Platform Execution Workers

**Status: RECOMMENDED FOR PUBLIC REPOSITORIES, standard GitHub-hosted runners.** Public repos can use standard GitHub-hosted runners for Linux x64, Linux ARM64, Windows, macOS with no per-minute charge for those eligible standard jobs. **Larger/GPU runners, private repository minutes and artifact/cache storage can incur charges**—never select those without review.

Official current runners: https://docs.github.com/en/actions/reference/runners/github-hosted-runners

## Standard public-repo sizes / labels (snapshot Oct 2026)

| Runner label | Arch | Public standard runner |
|---|---|---|
| `ubuntu-latest` | x64 | Linux 4 CPU, 16 GB RAM |
| `ubuntu-24.04-arm` | ARM64 | Linux 4 CPU, 16 GB RAM |
| `windows-latest` | x64 | Windows 4 CPU, 16 GB RAM |
| `macos-latest` | ARM64 | macOS M1 3 CPU, 7 GB RAM |

Runner hardware/labels can evolve; reference GitHub docs. Hosted runners are ephemeral and do not provide persistent Android screens or private credentials by default.

## Step-by-step manual setup

1. Open a **public** repository under your account (Grasshopper preferred). Verify Actions are enabled and repository policy permits standard hosted runners. Avoid exposing secrets or private code in public workflows; do not run privileged jobs on untrusted fork PRs.
2. Commit `.github/workflows/worker-network-plan.yml` and `.github/workflows/worker-network-tests.yml` from this project into the repo's **default branch**; manual `workflow_dispatch` appears only when the file exists there.
3. Go to **Actions → Multi-cloud worker plan → Run workflow** and choose a provider or `all`. This is a documentation/selection run only—there are **no cloud deployments or OAuth tokens**.
4. Trigger catalog tests; verify Linux x64/ARM64, Windows and macOS jobs report PASS. The included Python test suite requires standard-library Python preinstalled on the runner, no paid APIs or package downloads.
5. After tests, open job summary. If selected provider needs login, complete it on your trusted phone/desktop. Never paste access tokens or OAuth callback URLs as workflow inputs or public issue comments.
6. To run from Android Termux with your already authenticated `gh` CLI:
   ```bash
   gh auth status
   gh workflow run worker-network-plan.yml --repo onnxscibroccoli/Grasshopper -f providers=all
   gh run list --repo onnxscibroccoli/Grasshopper --limit 5
   ```
   Run only after the workflow is confirmed present in default branch; the code is manually triggered to avoid uncontrolled CI load.
7. For actual cross-platform project testing, create a **separate** safe matrix workflow with a locked dependency graph. Use pinned Action commit SHAs; `permissions: contents: read`; explicit job timeout, `fail-fast: false`, and working-directory isolation. Do not put OCI instance credentials into public CI.

## GitHub OIDC (future)

Provider trust must be established independently in each cloud account. Bind issuer `https://token.actions.githubusercontent.com` and repo/environment/branch subject precisely. Use `id-token: write` only for the *specific* protected job (not the whole project) that requires short-lived federation. The current worker plans intentionally do not have that permission. Set environment reviewers for any future deployment.

Official: https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-cloud-providers

## Resource/cost pitfalls

- `ubuntu-latest` and `ubuntu-24.04-arm` standard runners ≠ self-hosted persistent Grasshopper or an Android emulator. CI build/test containers are disposable.
- GitHub caches and artifacts count toward separate storage/retention quotas; use small outputs and audit retention.
- Keep `actions/checkout` pinned to an audited commit SHA in production workflows; do not run arbitrary Actions from random contributors.
- Never set `pull_request_target` with workflow script execution from untrusted PRs.

**Best initial result:** 4 heterogeneous ephemeral worker classes **without any new Azure/GCP/AWS/IBM account**.
