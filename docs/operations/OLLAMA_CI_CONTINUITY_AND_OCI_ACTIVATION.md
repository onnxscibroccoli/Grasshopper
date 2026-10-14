# Ollama CI Continuous Remediation & OCI Rollout — Activation Runbook

**Date:** 2026-10-13  
**Source of truth:** repository `main` exclusively. Proposed changes are in draft PR #193 until reviewed and merged.  
**Status:** Central offline contract CI was tested; live activation, production environment protection, OCI workload federation and Redroid deployment must not be treated as passed without their own evidence.

## 1. Mission and phased trust boundary

The Broccoli / Grasshopper platform joins reproducible Android and Linux accessibility automation, semantic UI graphs, unified action/event contracts, private operator authorization, code-generation agents and model/API/MCP connectors. Ollama classifies failure modes, while deterministic checks—not LLM confidence—define successful outcomes.

The **barn** analogy: each verified complex agent run is reduced to a labeled reusable **implement**, or bot recipe, with device transport, input schema, capability policy, idempotency key, test evidence, and rollback. The public bot catalog stores only deidentified, reviewed tools; the operational JSONL action ledger stays private.

A GitHub-hosted runner cannot execute indefinitely. To fulfill continuous development without infinite recursion or CI quota exhaustion:

- Every individual run has a strict maximum timeout, local model limit and at most two immediate recoveries.
- `ollama-ci-continuity.yml` optionally rechecks at **6-hour intervals**, only after repository variable `AGENTIC_SELFTEST_ACTIVATED=true` is deliberately set. State persists in [issue #194](https://github.com/onnxscibroccoli/Grasshopper/issues/194), not in ephemeral runner memory.
- The controller records safe failure **classes** and test run references; never raw logs, identities or credentials.
- Three identical failures, 16 unsuccessful episode rounds, or a structural compatibility defect ends the current episode with `AGENT_HANDOFF` and attempts a clean branch from canonical `main`; a fresh agent must take ownership from the issue and can open a reviewed PR.
- Expired interactive identity yields `HUMAN_HANDOFF`; CLI/API calls remain blocked. Completion requires the operator to finish browser authentication.
- A truly passing deterministic test suite with mainline provenance yields `VERIFIED`; otherwise the original failing workflow remains failed. No unsafe unbounded re-dispatch or automatic merge.

**Continuity is recurring bounded progress, not an infinite loop inside one runner.**

## Model acquisition and specialist routing (PR #193)

The central **three-attempt Llama 3.2 pull** is implemented in `scripts/agentic-ci/pull_ollama_model.sh`, shared by the activation gate, reusable self-test, central observatory, delegated observatory and continuity controller. It attempts the approved model at most **three times total**, checking both a successful `/api/pull` JSON status and presence of the *exact requested model* in `/api/tags`. Between attempts it waits **10 seconds, then 20 seconds** (linear backoff, no wait after attempt 3). Exhaustion returns a nonzero exit code; it never skips inference or reports a synthetic PASS. Offline tests simulate first-attempt success, one/two temporary failures, total exhaustion, malformed success responses, absent tags and rejected model names.

**Specialist routing:** The activation workflow adds an independent, two-model ARM64 job. `llama3.2:3b` maps current canonical-main repository structure and dependencies. `deepseek-coder:6.7b-instruct` performs granular code/syntax/refactoring inspection of explicitly selected source files from an independent checkout of **main**. Both models run only against local Ollama; model text is never treated as shell code or a verified implementation. DeepSeek uses the same verified three-attempt downloader, with the larger model run on a GitHub-hosted 16 GiB ARM64 VM and bounded, sequential model loading. The second model's code findings are grounded in mainline evidence references and the first model's structured system context. The CI job emits only model IDs, evidence counts and a content hash as an artifact; its complete model response remains private to the ephemeral runner.

**Promotion:** The native reviewer-protected gate additionally requires `two-model-specialists` to pass. Until real DeepSeek inference and private-model validation complete successfully, the proposal stays a draft; neither the specialized review nor the Llama routing may auto-edit source code, bypass tests or deploy to OCI.

| Condition | Expected behavior |
| --- | --- |
| First model pull succeeds | Exactly 1 attempt, zero delays |
| First failure, second success | 2 attempts, 10-second delay |
| First two failures, third success | 3 attempts, 10- and 20-second delays |
| All three attempts fail | Nonzero exit, fail-closed |
| HTTP 200 with malformed/incomplete response | Retry; cannot mark ready |
| Ollama reports model absent in tags | Retry; cannot mark ready |
| Llama overview succeeds but DeepSeek fails | Block specialist and deployment gate, preserve all working services |
| DeepSeek suggests code changes | Record for review; tests and human PR remain mandatory |

## Incremental DeepSeek inference and renewed timeout

**Observed blocker:** A real prior two-model workflow successfully pulled both models, then failed at the sequential review step with `SPECIALIST_REVIEW=BLOCKED_TimeoutError` after waiting for a non-streamed response. Model installation alone was not an inference PASS.

**Implementation in PR #193:**
- `llm_specialist_review.py` still invokes Llama 3.2 3B for high-level architecture mapping; it is capped at 900 seconds on the local Ollama HTTP request.
- For `deepseek-coder:6.7b-instruct`, the API request explicitly uses `stream: true` and `format: json`. Ollama sends **newline-delimited JSON** frames with `model`, incremental `response` text and a terminal `done: true` frame.
- The inference reader collects frames in a private in-process queue. The main controller uses a **600-second inactivity deadline, renewed at the monotonic arrival time of each nonempty response fragment**. An empty keepalive/metadata frame does **not** reset the deadline.
- A separate hard 5,400-second deadline limits total compute consumption even if a stream never finishes. A missing `done: true`, malformed frame, model-name mismatch, invalid final JSON, unexpected EOF or output larger than 256 KiB fails closed.
- Progress logs reveal **only chunk counts** (first frame and every 64 subsequent fragments), never model text, user data, source excerpts or secret-bearing API payloads. The model output stays private to the disposable runner.
- The sequential review step is allowed **125 minutes** and its specialist job **180 minutes**, independently capped by the streaming hard limit. GitHub-runner resource quotas and deployment gates remain authoritative.
- Offline regression tests simulate token events spanning longer than the idle limit, a model stall, empty keepalives, an absolute timeout, missing completion frames, mismatched models and truncated JSON. Each case either validates legitimate token-by-token renewal or produces a deterministic failure without fabricating an acceptance PASS.

**Acceptance:** A fully completed, exact-head GitHub Actions run must show Llama and DeepSeek returning evidence-linked JSON and the `ollama-specialist-routing-proof` artifact. Offline mock tests or partial chunk heartbeats are not sufficient. Production OCI/Redroid activation remains blocked until the existing independent zero-recursion, native HITL and Binder recovery gates pass.

## 2. Required Step 5 pre-activation gate

`.github/workflows/ollama-ci-activation-gate.yml` enforces the following:

1. **Offline contracts:** Python syntax; unit tests for recursion lineage, false-PASS rejection, artifact integrity, environment reviewers, continuity handoff and normal failure observatory boundaries.
2. **Live Ollama:** Launch official `ollama/ollama` in a GitHub runner container, pull `llama3.2:3b`, make a local JSON inference call, and reject malformed or unexpected results.
3. **Failure injection:** A controlled canary exits 42 once with a simulated transient failure; the unchanged command must succeed after an Ollama-advised allowlisted retry. The original failure, retry count, recovered output and private diagnostic code report are checked explicitly.
4. **Live zero-recursion:** Only after central `main` is active, manually dispatch `.github/workflows/ollama-ci-failure-canary.yml`; its intentional exit 27 creates a failed workflow. The workflow-run observatory should run exactly once and finish cleanly. Wait at least three minutes for observational stability. Then dispatch the activation gate on `main` with its actual `canary_run_id` to run `zero_recursion_live.py`. It must show one observer and no recursive observer descendants in the finite observation window. Synthetic tests alone are **not sufficient** for promotion.
5. **Protected proof:** A separate job tests the configured GitHub environment for required reviewers. If missing, fail closed. Following native approval, verify the exact successful canary/test artifact and write a SHA-256 evidence manifest, then publish a short-lived Actions artifact and its GitHub-provided archive digest. A digest is tamper-evident while retained; an ordinary GitHub artifact is not a permanent WORM ledger.

The activation proof applies **only to the CI harness and its output**, not to an Oracle kernel, Android Redroid boot, or production UI smoke test. Redroid requires its own signed build and acceptance evidence.

## 3. Native GitHub Human-in-the-Loop notifications, without SMTP credentials

**One-time operator setup:**

Go to **Grasshopper > Settings > Environments > New environment**; name it exactly `oci-grasshopper-production`. Add the intended reviewer under **Required reviewers**. Select **Prevent self-review** only if an independent approver will review runs started by the operator. Restrict deployments to trusted `main`. Save the protection rules and verify the guard can read them; if GitHub API permissions block verification, request an authorized repository settings review rather than bypassing the check.

The workflow's protected job will then wait for **Review deployments**. GitHub sends a review-request notification to configured recipients according to their GitHub notification settings. Reviewers can enable **Email** for Actions/deployment notifications under GitHub's personal notification settings; GitHub does **not** guarantee that every notification is delivered by email. No `dawidd6/action-send-mail` SMTP password or static email API token is introduced.

The native UI provides:

| Desired decision | GitHub-native control |
| --- | --- |
| **Proceed** | Review deployments → **Approve and deploy** |
| **Hold Off** | Leave pending, or **Reject** (which fails the job) |
| **Inspect Logs** | Open the workflow run and its job log/evidence links before deciding |

The preceding job's summary includes a concise change/status description, GitHub run URL, SHA-256 manifest and artifact link. An approval is not, by itself, authorization to reboot OCI or replace the boot kernel; those actions require a separate privileged maintenance runbook.

## 4. Zero-static-key authentication and browser escalation

**Unattended OCI host:** Prefer `oci ... --auth instance_principal` under a narrowly scoped OCI dynamic-group policy. Avoid service-user API keys or storing login sessions in GitHub Actions. The Grasshopper host's signed instance-principal read-only API invocation has already been verified.

**GitHub-hosted OCI control plane:** Oracle's 2026 JWT-to-RPST workload identity federation can exchange GitHub Actions OIDC tokens for short-lived OCI resource-principal credentials, with a one-time trusted identity-domain/IdentityPropagationTrust setup. The intent is documented at `config/oci-github-wif-intent.json`. Restrict issuer, audience, repository, `ref=refs/heads/main`, environment subject and OCI target privileges. **This trust has NOT been provisioned or tested yet**; the CI workflow must block remote mutation until it is.

**Human account session:** On the already authorized Grasshopper desktop, use the previously proven OAuth application or `oci session authenticate --region us-ashburn-1 --profile-name OMNIKALI`. The CLI/browser callback must occur on that workstation, not on an ephemeral headless GitHub runner. If `oci_auth_gate.py` cannot validate instance-principal access or the interactive session, it exits `AUTH_HANDOFF_REQUIRED`. Its printed instruction contains no temporary OAuth token or callback link. The operator opens the trusted remote desktop/browser and authenticates; no password is pasted into ChatGPT.

**Sudo:** A human may run an explicitly reviewed, checksum-matched elevated installer locally on Grasshopper after validation. The assistant/RDC does not receive a reusable sudo password, passwordless wildcard sudo policy, exported root shell, or GitHub secret. Privileged changes should use a narrowly scoped root-owned script authorized through the workstation itself, with sudo prompts remaining inside the remote session.

## 5. OCI Oracle Linux 9 / Redroid deployment

**Verified target:** Oracle Linux 9.8 aarch64, UEK `6.12.0-206.104.4.4.el9uek.aarch64`. The external Binder PR #21 failed at an unexported `zap_page_range_single` ABI. Exact signed Oracle source has been staged and a separate in-tree Binder/BinderFS candidate config prepared. These are technical steps, **not** a passing kernel boot proof.

The workflow `.github/workflows/oci-grasshopper-protected-stage.yml` verifies mainline CI proof, requires configured native reviewers, and obtains an authenticated human approval. It intentionally runs on a **GitHub-hosted ARM64 runner**, not an agent installed on the protected public-repository OCI workstation. GitHub explicitly advises against connecting persistent self-hosted runners to public repositories because untrusted pull requests could execute there. The final job **blocks host deployment** until scoped OCI OIDC federation, verified signed kernel artifacts, independent Kali/RustDesk/noVNC recovery and an operator-approved, rollback-tested maintenance operation exist.

When all deployment prerequisites have proof:
- Preserve the existing Grasshopper and Kali desktops, working remote access, nginx ingress, RustDesk/noVNC and live QEMU Android.
- Stage signed kernel/config and Redroid artifacts on the existing separate `/srv/grasshopper` data volume, not the nearly-full 30GB root filesystem.
- Snapshot package/service/bootloader versions and running transport tests before any mutation; verify backups and independent out-of-band console access.
- Configure Binder support with vendor-matched Oracle UEK in-tree source. Confirm full build, Secure Boot compatibility, module/device creation and rollback boot entry in isolation before requesting the user to authorize privileged activation.
- No automatic live kernel replacement, no automatic reboot, no stopping the old Android guest, no public ADB or exposing remote sessions.
- Only after new kernel Binder is functional, launch one persistent Redroid ARM64 worker with memfd, private ADB bound to loopback, and strict memory/storage admission. Prove Android `sys.boot_completed=1`, functional screen/IME, reconnect and recovery.
- Accept production only if both workstations and all external access paths remain operational after the transition.

## 6. OCI proof ledger

`scripts/agentic-ci/proof_ledger.py` hashes the **bytes of the verified file** using SHA-256, stores the source repo, mainline ref, GitHub run ID, pass flags and UTC timestamp, and verifies the content on consumption. `actions/upload-artifact@v4` returns an artifact digest and URL for review. OCI Object Storage can later hold a retained copy **after** workload federation and bucket retention policies are configured; no Object Storage write or immutable WORM guarantee is claimed in the draft.

## 7. Validation / failure / handoff matrix

| Failure mode | Evidence gate | Automated action | Terminal outcome / human trigger |
| --- | --- | --- | --- |
| Ollama container fails health probe or model pull | No localhost inference | Fail job; record safe error class; bounded later recheck | After repetition, `AGENT_HANDOFF` with next technical task |
| Llama returns invalid JSON or unsafe remedy | Strict schema/model and command allowlist | Deterministic fallback; no shell execution of suggestion | `FAIL` if exact check cannot pass |
| Initial test fails, deterministic retry succeeds | Original exit code + new postcondition | Maximum 2 exact-command retries; record both states | `PASS_AFTER_RETRY` flagged for review |
| Original test continues failing | Nonzero exit and missing expected output | Redact diagnostic class, retain unchanged tests | `FAIL` → bounded continuity → agent handoff |
| Upstream CI job failed/cancelled/skipped | `needs` job results | Do not start a greenwashing check | `BLOCKED_UPSTREAM`, source fix required |
| Failed test model proposes deleting tests or bypassing checks | Privilege/command/contract allowlist | Reject proposal | `FAIL`, reviewed code patch only |
| Observer detects itself or nested `workflow_run` | Parent workflow, action, actor, lineage hop | Reject observation, never dispatch child | Zero-recursion probe fails unless controlled canary proven |
| Empirical observer canary not available | No actual failed main run + observer | Refuse readiness proof; no production activation | Manual canary dispatch and inspection required |
| Human OAuth expired | OCI signed read fails + session validation | Stop actions; no browser token in CI logs | `HUMAN_HANDOFF`: complete browser in Grasshopper |
| GitHub OIDC→OCI federation absent | No validated trust/RPST and policy | Block OCI mutation; no API key fallback | Authorized IAM identity-domain setup required |
| OCI Run Command accepted but not executed | Command lifecycle stays `ACCEPTED` | Do not mark root available | Repair OCI delivery and host access before deployment |
| Environment missing required reviewers | Environment API protection check | Block publishing/deployment | Admin must configure native GitHub Required reviewers |
| Reviewer wants to inspect or hold | Protected job `Waiting` | No host action | Inspect run; wait or Reject |
| Source artifact hash mismatch | SHA-256 manifest verifier | Stop consumer; no deployment | Rebuild from main and regenerate fresh proof |
| OCI kernel Binder ABI mismatch | Build/module symbols, device nodes | Preserve old host and QEMU | Vendor kernel build + independent rollback + sudo authorization |
| noVNC, RustDesk or Kali recovery check fails | Service health + remote operator smoke | Abort rollout, leave old kernel | Repair access before touching boot path |
| Runner capacity exhausted | CI timeout/concurrency | Stop finite run; retain issue state | New scheduled run or agent/human handoff |

## 8. Mandatory activation order

1. Review/merge the central workflow **only after** GitHub-hosted offline tests and live container Llama canary pass.
2. Correct workflow/source problems detected in CI rather than marking failures passed.
3. Configure required GitHub Environment reviewers and confirm notifications; default-deny if the environment cannot be inspected.
4. Run the **real** failed-workflow canary on central `main`, observe exactly one diagnostic job, and verify no self-recursion within the documented window.
5. Publish an environment-approved SHA-256 proof receipt tied to an actual passing run. A failed step at any point blocks production activation.
6. Opt in to the durable 6-hour controller by repository variable only after the above gates pass. It may create new feature branches at conclusive handoffs but never auto-merge.
7. Make dependent repository observatories ready one by one only after central `main` is stable; separate PRs remain drafts until then.
8. Configure OCI GitHub OIDC workload federation through approved interactive IAM setup; verify no static API keys and no privileged public self-hosted runner.
9. Prepare an independently bootable/rollback-tested Oracle UEK Binder kernel and a verified Redroid staging artifact.
10. Request operator sudo only at the final privileged checkpoint, preserve Kali/Grasshopper remote service access, and complete device/live smoke acceptance before declaring deployment PASS.

**Known limitation:** GitHub runners cannot run forever; this design progresses through bounded runs and ends episodes with a clear handoff instead of hiding infinite failures. Native GitHub required-reviewer email is notification-preference dependent, not a guaranteed transactional email gateway. OCI kernel/Redroid deployment remains unverified until actual host and UI checks pass.
