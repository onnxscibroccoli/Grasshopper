# ARM64 live control observation — 2026-10-08

Contract: OCI-ARM64-ADB-20261008-01. This bounded diagnostic contract completed its observations; Android control acceptance failed its gate. R2 remains NOT_PROVEN.

## Source, identity and preservation

Source baseline: PR #168, `85fe2c74841dff50fd1e6a30ecd1486876add471`. This source reference is not proof that every live guest artifact was built from that commit. RDC node `0852e6f4-2507-4d0f-9d62-f6eda8cdd169` was verified as grasshopper-workstation, aarch64, OCI VM.Standard.A1.Flex before diagnostic execution.

At 2026-10-08 05:49:26 UTC the original QEMU PID 1123620, started 01:37:50 UTC, remained running. No guest restart, disk reset, input injection, access-policy change, or deployment was performed. Other guest containers were observed but not modified. Cloud chat, guest disks and existing dirty source work were preserved.

## Resource envelope, lease and recovery

Live original: 2 vCPU, 2048 MiB guest RAM, TCG multi, virtio-gpu, CPU max with pauth-impdef=on. Observed QEMU RSS 1,948,260 KiB and lifetime CPU 59%; these are a snapshot and cumulative percentage, not a sampled interval utilization test.

Diagnostic ADB clients used the existing local runtime image, transient containers with 128 MiB memory, and individual 5–8 second command timeouts. An initial attempt with a 0.25 CPU quota failed because the CPU controller was unavailable; the bounded retry omitted that unsupported quota. Client servers were stopped and transient containers removed. No persistent diagnostic worker or resource lease was created. The observation lease ended with client cleanup. Future clients should use a dedicated ADB server port to avoid interference with concurrent work. Recovery means stop only the diagnostic client; do not stop the original guest.

## Acceptance observations

- ADB endpoint 127.0.0.1:16555: connect succeeded and get-state returned device.
- ADB features were returned, including shell_v2.
- getprop sys.boot_completed and shell true both returned error: closed.
- A bounded logcat request waited for device and timed out; no successful logcat collection is claimed.
- VNC 127.0.0.1:5906 capture showed a 1280x800 LineageOS Welcome screen and “Setup Wizard isn't responding” dialog.
- Keyboard, pointer, browser reconnect and physical-phone/cloud control were not tested because the boot/shell gate remained unmet.

The framebuffer artifact is retained on OCI at `/srv/grasshopper/android/development/arm64-observation-20261008/direct-0548.png`.
SHA-256: `2ed8bfb826576a1351d07ccada416a2eb0a299d0d6bcbffc8cab1c5c10e5c1d3`.

Serial diagnostics show system_server activity around guest seconds 4875–5183, adbd stop/start around 5048–5049, and a denied mdnsd service request under adbd_tradeinmode at 5052. This is a lead for shell restriction diagnosis, not proof of the sole cause. Do not disable SELinux or authentication to make a test pass. Later serial output contains system_suspend sysfs denials; boot completion was not established.

## Integration and next contract

PR #168 was open, draft, unmerged and reported non-mergeable at observation time. The workflow lookup returned no PR-triggered runs for its exact head; full CI acceptance remains unverified. No release tag, merge or deployment occurred.

Next contract: inspect supported adbd/trade-in-mode behavior and Setup Wizard ANR evidence without restarting QEMU; correlate fresh CPU, process and serial evidence before network changes. Once an authenticated shell and sys.boot_completed=1 are freshly proven, capture before/after frames and prove a harmless HOME/input result and reconnect on the same guest and transport.

The separate [integration map](OCI_ARM64_CONTROL_INTEGRATION_MAP.json) records only this observation. The older OCI_TCG_INTEGRATION_MAP.json is absent at the PR #168 baseline and was not fabricated or copied from another branch. Validation for this documentation-only change checks JSON parsing, state assertions, source reference and links; it is not an Android test-suite pass.

## Follow-up control contract

Contract `OCI-ARM64-CONTROL-20261008-02` ran from 06:50:04 through 06:51:32 UTC against the same original PID and endpoints. Node identity and OCI instance identity were reverified before execution. The process start time remained 01:37:50 UTC, both loopback listeners remained owned by PID 1123620, and the original container remained up. No guest restart, disk/EFI reset, policy change, package change, or additional guest launch occurred.

This contract established a boundary the first observation missed:

- the serial log contains init processing `sys.boot_completed=1` at guest second 4722.970948, followed by successful boot-complete actions;
- a dedicated ADB server on port 5041 independently reproduced `connect` and `get-state=device`, while `shell true` and `shell getprop sys.boot_completed` both closed;
- the same log shows adbd restarting at guest seconds 5048–5049 and then running in `adbd_tradeinmode`, with a denied mdnsd control request; this correlates with the closed shell but is not yet proven as the sole cause;
- two separate VNC client connections captured the 1280x800 framebuffer successfully, which proves command-client RFB reconnect, not browser/noVNC reconnect;
- HOME was delivered but produced no framebuffer change while the ANR dialog owned focus;
- a pointer click on the visible `Wait` row changed the framebuffer from SHA-256 `2ed8bfb826576a1351d07ccada416a2eb0a299d0d6bcbffc8cab1c5c10e5c1d3` to `3cf4316ab51af435523ca6f7c45914037f617d288b4ec5dffaf69eaf63f49dd1`, clearing the dialog text while leaving its surface present;
- a later independent capture retained the new hash, so pointer delivery and compositor-visible acknowledgement passed, but Setup Wizard recovery did not.

The new artifacts are retained at:

- `/srv/grasshopper/android/development/arm64-observation-20261008/home-before-20261008T065031Z.png`
- `/srv/grasshopper/android/development/arm64-observation-20261008/home-after-20261008T065031Z.png`
- `/srv/grasshopper/android/development/arm64-observation-20261008/wait-after-20261008T065055Z.png`
- `/srv/grasshopper/android/development/arm64-observation-20261008/wait-late-20261008T065127Z.png`

The two HOME captures have the original hash. The two post-pointer captures have the changed hash. A five-second `/proc` CPU-time delta measured QEMU at 85.8% of one logical CPU on a two-logical-CPU host; RSS was 2,150,188 KiB at the end of that sample. This is a bounded interval sample, not evidence that the host is generally unconstrained. QEMU remained alive after all probes.

Recovery for the contract was limited to stopping the dedicated transient ADB client; the VNC command clients disconnected normally. ADB shell control, semantic Setup Wizard recovery, browser reconnect, physical-phone control, authenticated same-source R2, full CI, merge and deployment remain unproven. The next bounded contract should diagnose why the supported Android image selects trade-in-mode adbd and why Setup Wizard remains ANR, without weakening SELinux/authentication or restarting the original guest.

## Trade-in-mode root-cause contract

Contract `OCI-ARM64-TIM-20261008-03` ran from 07:45:42 through 07:47:04 UTC against source baseline PR #168 commit `85fe2c74841dff50fd1e6a30ecd1486876add471` and the unchanged original PID. RDC node `0852e6f4-2507-4d0f-9d62-f6eda8cdd169`, hostname, architecture, OCI instance identity and shape were reverified before execution. The live envelope remained 2 vCPU, 2048 MiB guest RAM, TCG multi and virtio-gpu; QEMU had the same 01:37:50 UTC start time, RSS was 2,243,500 KiB at admission, and the process remained alive. No guest restart, disk/EFI change, network change, security-policy change or new guest launch occurred.

Android 16's documented behavior explains the ADB boundary. On a non-debuggable user build during incomplete Setup Wizard, with ADB initially disabled and no active network/account, `DeviceDiagnostics` asks `TradeInModeService` to set `persist.adb.tradeinmode=1` and enable ADB. adbd then enters the restricted `adbd_tradeinmode` SELinux domain, where normal shell commands are intentionally closed and only the `tradeinmode` helper is admitted. This is an Android platform state, not evidence of a broken TCP forward. Primary references:

- <https://android.googlesource.com/platform/packages/modules/adb/+/HEAD/docs/dev/adb_tradeinmode.md>
- <https://android.googlesource.com/platform/frameworks/base/+/refs/heads/android16-release/services/core/java/com/android/server/TradeInModeService.java>
- <https://android.googlesource.com/platform/packages/modules/adb/+/refs/heads/main/daemon/tradeinmode.cpp>

Two bounded, read-only helper probes used dedicated ADB server ports and a transient 128 MiB client container. Output was summarized without printing device identifiers:

- `tradeinmode getstatus` produced zero stdout bytes and did not complete within 12 seconds;
- `tradeinmode` with no arguments produced zero stdout bytes and did not complete within 6 seconds;
- both client-side timeouts returned 143; no success is claimed;
- serial AVCs prove that the admitted command transitioned from `adbd_tradeinmode` into the `tradeinmode` domain;
- the corresponding timeout signals were denied between the restricted domains, so the probes were not repeated.

The observed `apexdata`, `userfaultfd`, JIT-cache and dalvik-cache AVCs resemble denials explicitly documented as noncritical in the original AOSP trade-in-mode policy change. They are therefore evidence of helper execution, but not sufficient proof of the stall's root cause. The live serial log also records binder transaction latency, repeated ANR/watchdog activity and another untracked system_server helper zombie around guest seconds 18777–18845. The remaining hypothesis is system-service degradation or extreme latency downstream of the correctly admitted helper, not failure at the host TCP/ADB handshake boundary.

Recovery ended both transient host clients and removed their containers. Because the restricted domain denied the timeout signal, future live helper retries are prohibited until a guest-process cleanup/recovery method is proven that does not restart or weaken the original guest. Setup Wizard recovery, a successful `tradeinmode getstatus`, authenticated normal shell, browser reconnect, physical-phone control and R2 remain `NOT_PROVEN`.

The next bounded contract should compare this image/build combination with a clean, isolated Android 16 reference boot and its SELinux policy while leaving the original guest untouched. The durable fix belongs in build/profile selection or supported provisioning—not an SELinux bypass on the live guest.

## Image-profile admission contract

Contract `OCI-ARM64-PROFILE-20261008-04` compared the pinned release artifact with the upstream release build source offline. Upstream selects `virtio_arm64only userdebug` only to build `recoveryimage`, then selects `virtio_arm64only user` before building the UTM VM archive and OTA package. The pinned `UTM-VM-lineage-23.2-20260709-jqssun-virtio_arm64only.zip` is therefore a full `user` VM; the separately published userdebug recovery image is not a full automation VM profile.

The contract added a fail-closed profile gate to `scripts/cloud-android/arm64-device.sh`. `prepare`, `start`, and `restart` now exit 75 before tool, network, disk or container operations unless `CLOUD_ANDROID_ARM64_ALLOW_SETUP_GATED=1` explicitly admits the image for interactive provisioning. The override reports `PROFILE_ADMITTED=INTERACTIVE_SETUP_ONLY` and `NORMAL_ADB_SHELL=NOT_PROVEN`; no path emits an automation-ready claim. The environment profile records normal ADB shell as conditional. A full normal-shell automation profile now requires a separately provenance-pinned full `userdebug` VM artifact and fresh acceptance evidence.

The test-first contract initially produced two expected failures because `profile-admission` did not exist. After implementation, the focused suite passed 5/5, the full repository suite passed 237/237, and shell syntax, JSON parsing and the degradation guard passed. The contract used only the local source worktree and read-only upstream source retrieval; no guest, image, EFI, disk, container, network or access-control mutation occurred. Its local execution envelope was one Node test process and short Bash child processes under a 20-minute lease. Recovery is to revert this isolated commit; the existing live guest is not part of that recovery path.

At the preservation check, RDC node `0852e6f4-2507-4d0f-9d62-f6eda8cdd169` was reverified as `grasshopper-workstation`, `aarch64`, OCI `VM.Standard.A1.Flex`. Original QEMU PID 1123620 retained its 2026-10-08 01:37:50 UTC start time, 2 vCPU/2048 MiB command line and running state. The source guard was not invoked on OCI and no second guest was launched.

Normal authenticated ADB shell, browser reconnect, physical-phone control, semantic Setup Wizard recovery and R2 remain `NOT_PROVEN`. The next contract should produce a reproducible full `userdebug` VM build profile and artifact-provenance manifest on a clean isolated build path without disturbing the original live guest; alternatively, complete the pinned user image's supported interactive provisioning and then freshly prove authorization and all R2 controls.

## Full-userdebug provenance contract

Contract `OCI-ARM64-USERDEBUG-PROFILE-20261008-05` defines—but does not build or launch—the smallest admitted full `userdebug` VM profile. It is stacked on PR #170 commit `2abe93ae86473745c7bb71f15395cdcaa94d6925`. The upstream tag `v2026.07.09` resolves to commit `54fc5dc82fa05778be15c1200240be53f707a542`; its `build.sh` blob is `b5babcdbefa664b1ffc447bda4dcf53b17628cb6`. That source builds `virtio_arm64only userdebug` only for `recoveryimage`, then selects `virtio_arm64only user` for `vm-utm-zip otapackage`. The new profile requires the full VM goals to remain on `userdebug` and explicitly prohibits recovery-only substitution.

The bounded implementation adds:

- `environments/cloud-android-arm64-userdebug-build.json`, pinning repository, tag, commit, build-script blob, target, variant, goals and non-execution boundaries;
- `deploy/cloud-android/arm64-userdebug-provenance.template.json`, an intentionally incomplete evidence template that cannot pass verification;
- `scripts/cloud-android/verify-arm64-userdebug-provenance.mjs`, which binds a candidate manifest to the pinned source, archive name, SHA-256, byte size, both UTM qcow2 members, a SHA-256-bound `build.prop`, `ro.build.type=userdebug`, and `ro.product.cpu.abi=arm64-v8a`;
- behavioral tests that accept valid synthetic full-VM evidence and reject a `user` variant, same-size artifact tampering, a missing persistent disk, non-userdebug properties and the incomplete repository template.

The TDD red run failed 0/5 because the verifier did not exist. The green focused suite passed 6/6; the full repository suite passed 243/243, and Node syntax, JSON parsing, diff and degradation checks passed. No LineageOS build, artifact download, VM launch, cloud provisioning or live-guest command occurred. Local execution was limited to Node tests and small temporary synthetic files under a 30-minute lease; test cleanup removed those temporary files. Recovery is a commit revert and does not involve either running guest.

RDC node `0852e6f4-2507-4d0f-9d62-f6eda8cdd169` was reverified as `grasshopper-workstation`, `aarch64`, OCI `VM.Standard.A1.Flex`. Read-only process evidence showed original PID 1123620 still running with its 2026-10-08 01:37:50 UTC start time. Concurrent isolated PID 1242165 was also observed and not mutated. The candidate full-userdebug artifact remains `NOT_BUILT`; normal ADB shell, browser reconnect, physical-phone control and R2 remain `NOT_PROVEN`.

The next contract is a clean-builder resource-admission plan and reproducible source patch/workflow. It must quantify free disk, memory, CPU, lease, checkpoint and cleanup requirements before any build is authorized, and it must not consume paid capacity or run alongside unadmitted live workloads.

## Clean-builder admission contract

Contract `OCI-ARM64-USERDEBUG-ADMISSION-20261008-06` is stacked on PR #171 commit `110b8f8327a357538c91a1f59aa207c617d37300`. It adds a deterministic resource policy, snapshot evaluator, exact upstream source patch and bounded build/checkpoint/recovery plan. It does not add a live collector and cannot authorize a build from simulated evidence.

The policy requires AArch64, 8 logical CPUs, 32 GiB total and 24 GiB available RAM, 300 GiB free workspace, one-minute load no higher than half the logical CPU count, zero active QEMU processes, a lease no longer than 24 hours, and an absolute persistent checkpoint path. The 32 GiB RAM and 300 GB storage floor follow LineageOS guidance for 18.1 and newer; the CPU, currently available memory, load, QEMU isolation, lease and checkpoint limits are Grasshopper policy.

The exact source patch SHA-256 is `710a680aa0e1b6e5630e541ad7313bf183fc9cb1da64b3356f0aafdea310cbb6`. A temporary local copy of upstream `build.sh` was verified as Git blob `b5babcdbefa664b1ffc447bda4dcf53b17628cb6`; `git apply --check` passed, applying it changed both ARM64 build selections to `userdebug`, and the temporary validation directory was removed. No upstream clone, source sync or build ran.

At 2026-10-08 12:46 UTC, after RDC identity verification, the OCI workstation reported 2 logical CPUs, 11,159,744 KiB total RAM, 5,098,188 KiB available RAM, 46,636,859,392 bytes free on `/srv/grasshopper`, one-minute load 1.09 and one running QEMU process consuming about 173% CPU with 3,414,816 KiB RSS. The resource gate is therefore `BLOCKED` on CPU count, total/available RAM, workspace capacity, load and active QEMU isolation.

The live process boundary had changed outside this contract: previously recorded PIDs 1123620 and 1242165 were absent, while QEMU PID 1273533 had started at 2026-10-08 12:12:08 UTC in container `grasshopper-cloud-android-arm64`. This contract did not cause, replay or modify that transition. It issued only read-only identity, resource and process observations. Prior live-control evidence cannot be promoted to the replacement process without fresh same-process acceptance.

The test-first red run failed 0/5 because the evaluator did not exist. The focused green suite passed 5/5, the combined admission/provenance suite passed 11/11, and the full repository suite passed 248/248. Node syntax, JSON parsing and `git diff --check` also passed. The focused cases prove admission for a clean synthetic envelope and rejection for active QEMU, inadequate RAM/disk, inadequate CPU/load, and missing checkpoint/unbounded lease. Recovery is a commit revert; no live host state requires rollback.

The next contract should add a tested live snapshot collector and signed/hashed admission artifact on a genuinely isolated builder. Until a separate host meets the envelope, the full-userdebug build stays `BLOCKED_RESOURCE_ADMISSION`; candidate artifact, authenticated ADB shell and R2 remain `NOT_PROVEN`.

## Live builder-evidence contract

Contract `OCI-ARM64-USERDEBUG-EVIDENCE-20261008-07` is stacked on PR #172 commit `123bd3635c945c69f304960d7e9d8b521d6cc2ce`. It adds a read-only live resource collector and canonical SHA-256 evidence format. The record binds exact profile bytes, the collected snapshot, and the admission result; verification recalculates all three digests and replays policy. Only literal `/proc` collection is labeled `LIVE`. Fixture process roots are labeled `TEST_FIXTURE`, tampering is rejected, and incomplete `/proc/<pid>/exe` visibility blocks with `process_scan_ambiguous`.

The process boundary uses executable identity, not a command-line substring. This prevents diagnostics such as `grep qemu-system-aarch64` and a container shell whose script text contains the QEMU command from being miscounted as QEMU processes. Evidence creation uses exclusive file creation and will not overwrite an existing admission record.

At 2026-10-08 13:44 UTC, RDC device `0852e6f4-2507-4d0f-9d62-f6eda8cdd169` was reverified as `grasshopper-workstation`, AArch64, OCI region `iad`, shape `VM.Standard.A1.Flex`. Read-only observation reported 2 logical CPUs, 11,159,744 KiB total and 5,480,884 KiB available RAM, 46,635,491,328 bytes free on `/srv/grasshopper`, one-minute load 2.27, and QEMU PID 1273533 still running from 12:12:08 UTC with 3,410,784 KiB RSS. The active host remains blocked on CPU, RAM, workspace, load and QEMU isolation.

The collector was not copied to or run on OCI: this contract permits exercise only on a genuinely isolated builder, and the read-only pre-observation already proves this workstation is ineligible. No guest, process, disk, EFI, container, network, access control or cloud resource was changed. The local test-first red run failed 0/5 because the collector did not exist; the focused collector/admission suite subsequently passed 10/10, the combined collector/admission/provenance suite passed 16/16, and the full repository suite passed 253/253. Node syntax, JSON parsing, diff and degradation checks also passed. Recovery is a commit revert; no remote rollback is required.

The next contract should inventory already-authorized, no-paid-capacity nodes against the static envelope without starting workloads. If none qualifies, retain `BLOCKED_RESOURCE_ADMISSION` and continue provider-neutral repository work. The full-userdebug artifact remains `NOT_BUILT`; authenticated normal ADB shell, browser/phone control and R2 remain `NOT_PROVEN`.

## Existing-builder candidate contract

Contract `OCI-ARM64-USERDEBUG-CANDIDATES-20261008-08` is stacked on PR #173 commit `db55cd70bcc9c254032118b9bf1c306551391fe6`. It records and verifies the already-authorized, no-new-capacity candidate set without provisioning, starting workloads or running the live collector on an ineligible node.

At 2026-10-08 14:53 UTC, RDC listed OCI `grasshopper-workstation` and an endpoint named `localhost` online, the protected AWS endpoint offline, and a stale OCI registration offline. The bounded `localhost` identity call returned no result and was not replayed, so its identity and capacity remain `NOT_PROVEN`. AWS was not contacted. On the verified OCI workstation, `gcloud` reported zero active accounts; this proves only that the workstation has no authorized GCP path, not that credentials are absent elsewhere.

OCI identity was reverified first as `grasshopper-workstation`, AArch64, region `iad`, shape `VM.Standard.A1.Flex`. Fresh read-only capacity was 2 logical CPUs, 11,159,744 KiB total and 5,420,452 KiB available RAM, 46,634,475,520 bytes free on `/srv/grasshopper`, one-minute load 0.52 and exactly one executable-identified QEMU process, PID 1273533. It remains `BLOCKED_RESOURCE_ADMISSION`.

The provider-neutral matrix classifies OCI as blocked, the unidentified RDC endpoint as unqualified, GCP as excluded because a new node would require provisioning, and AWS as protected/excluded. The verifier prohibits `build_authorized=true`; even a static snapshot that passes every capacity threshold becomes only `ELIGIBLE_FOR_LIVE_COLLECTION`. The test-first red run failed 0/5 before the verifier and matrix existed; the initial green suite passed 5/5. A separate red/green case proved provisioning-required nodes stay excluded, bringing the focused suite to 6/6. The combined userdebug suites passed 22/22 and the full repository suite passed 259/259; Node syntax, JSON, diff and degradation checks also passed.

Remote activity was limited to identity and read-only capacity/account-count observations. No guest, process, disk, container, network, access control, API, billing setting or cloud capacity changed. Local work used Node and small temporary JSON files under a 20-minute lease. Recovery is a commit revert; no remote rollback is required.

No existing node qualifies. The build remains `BLOCKED_RESOURCE_ADMISSION`, the candidate artifact remains `NOT_BUILT`, and authenticated ADB plus R2 remain `NOT_PROVEN`. The next provider-neutral contract should bind this candidate inventory to a reusable JSON Schema and CI check, then resume independent Android control work that does not require the blocked full-image build.

## Candidate-schema contract

Contract `OCI-ARM64-USERDEBUG-CANDIDATE-SCHEMA-20261008-09` is a repository-only change stacked on PR #174 commit `59c7ba0e65bf9214f15acbc4d228acb11c0d8478`. It adds a reusable Draft 2020-12 schema for the provider-neutral candidate inventory, a dependency-free validator for the schema keywords used by that file, and the deterministic `npm run verify:cloud-android-userdebug-candidates` entrypoint. The command validates structure first and then independently recomputes every candidate classification from the pinned builder policy.

The schema rejects undeclared fields, malformed snapshots and any `build_authorized` value other than `false`. Its runtime is intentionally bounded to the keywords exercised by this schema; it is not presented as a general replacement for a complete JSON Schema implementation. The test-first red run failed because the validator and npm entrypoint did not exist. The focused green suite passed 9/9, the combined userdebug suites passed 25/25, and the full repository suite passed 262/262. The degradation guard, Node syntax, JSON parsing and diff checks also passed.

Execution used only the isolated local worktree, Node.js and temporary JSON fixtures under a 20-minute lease. No RDC endpoint was contacted, no prior node observation was replayed, and no guest, process, disk, container, access control, API, billing setting or cloud capacity changed. Recovery is a commit revert; no remote rollback is required. The matrix remains `NO_ELIGIBLE_NODE`, `build_authorized=false`; the full-userdebug artifact remains `NOT_BUILT`, and authenticated ADB plus R2 remain `NOT_PROVEN`.

The next provider-neutral Android control task should define and test the transport-neutral input acknowledgement and reconnect evidence format, without depending on the blocked full-userdebug build or claiming live R2 acceptance.

## Provider-neutral control-evidence contract

Contract `ANDROID-CONTROL-EVIDENCE-20261008-10` is a repository-only change stacked on PR #175 commit `934e5033759a06c24047bcf21487d9df56b9bc1b`. It adds `grasshopper.android-control-evidence/v1`, a shared evidence format for workstation, browser and physical-Android control origins, plus a deterministic verifier and fail-closed repository template.

The verifier deliberately separates command delivery, compositor-visible acknowledgement, semantic UI effect and reconnect continuity. PASS gates require byte-counted SHA-256 artifacts stored beside the evidence document. Delivery must be an original dispatch, acknowledgements must reference the exact input sequence, visible acknowledgement requires distinct frame hashes, and reconnect requires the same session identity with advancing sequence and no guest restart. A visible frame change cannot imply semantic success. Every `TEST_FIXTURE` bundle evaluates to `NOT_PROVEN`, even when its four internal gates pass, and this evidence type cannot independently close R2.

The TDD red run failed 0/5 because the verifier, schema, template and npm command did not exist. A second focused red/green cycle added source-SHA pattern enforcement to the shared schema runner. The resulting focused suite passed 6/6, the combined control/transport suite passed 9/9, and the full repository suite passed 268/268. The candidate-matrix command, degradation guard, Node syntax, JSON parsing and diff checks also passed. Execution used only the isolated local worktree, Node.js and disposable temporary artifacts under a 20-minute lease. No RDC endpoint was contacted and no guest, process, disk, container, access control, API, billing setting or cloud capacity changed. Recovery is a commit revert; no remote rollback is required.

The durable live state remains unchanged: userdebug artifact `NOT_BUILT`; authenticated shell, browser reconnect, semantic UI recovery, physical-phone control and R2 `NOT_PROVEN`. The next bounded task is to adapt the existing workstation/RFB observation path to emit this evidence format without injecting new input or claiming live acceptance, then separately qualify browser and physical-Android transports.

## Workstation RFB observation-adapter contract

Contract `ANDROID-CONTROL-RFB-ADAPTER-20261008-11` is a repository-only change stacked on PR #176 commit `9bab651b0e378febdc47af851a0ee1cc17019bef`. It adds an observation-only adapter for existing workstation RFB frame artifacts. The adapter binds the exact source SHA, node, session, sequence and transport from a manifest; verifies frame byte counts and SHA-256 digests; emits `grasshopper.android-control-evidence/v1`; and refuses output overwrite.

The adapter performs no connection, input injection or command replay. An observed operation is retained only as provenance and can never become `ORIGINAL_DISPATCH`. Different frame hashes can prove compositor-visible acknowledgement, but delivery, semantic effect, reconnect continuity, overall live acceptance and R2 remain `NOT_PROVEN`. Identical frames remain `NOT_PROVEN`. `TEST_FIXTURE` outputs remain synthetic regardless of their internal visual gate.

The test-first red run failed because the adapter did not exist. The focused adapter suite then passed 6/6 and the combined adapter/control/transport suite passed 15/15. An initial full run passed 273/274 but exposed the existing durable-executor cancellation timing race; that file passed 14/14 in isolation and the clean full rerun passed 274/274. The candidate-matrix command, control-template command, degradation guard, Node syntax, JSON parsing and diff checks also passed. Execution used only the isolated local x86_64 worktree, Node.js and disposable temporary files under a 20-minute lease. No RDC endpoint was contacted and no guest, process, disk, container, access control, API, billing setting or capacity changed. Recovery is a commit revert; no remote rollback is required.

The durable state is unchanged: builder matrix `NO_ELIGIBLE_NODE`, userdebug artifact `NOT_BUILT`, and authenticated shell, browser reconnect, semantic UI recovery, physical-phone control and R2 `NOT_PROVEN`. The next bounded task is a repository-only browser reconnect observation adapter that proves client reconnect continuity only when session identity and advancing sequence are independently recorded, while retaining all unsupported gates as `NOT_PROVEN`.

## Browser reconnect observation-adapter contract

Contract `ANDROID-CONTROL-BROWSER-RECONNECT-20261008-12` is a repository-only change stacked on PR #177 commit `b82d1940e56712e18abe72005f4451e82f07aaef`. It adds an observation-only adapter for an independently captured, digest-bound browser reconnect record. The record binds exact source SHA, node, transport and pre/post guest-session identity; requires an advancing sequence, client-only disconnect, no guest restart and chronological timestamps; and becomes the artifact for only the reconnect-continuity gate.

The adapter never connects to a browser, WebSocket, RFB server or guest, and never dispatches or replays input. It verifies record byte count and SHA-256, rejects identity mismatch and refuses to overwrite existing evidence. Delivery, visual acknowledgement, semantic effect, overall live acceptance and R2 remain `NOT_PROVEN`, including when reconnect continuity passes. Synthetic fixtures remain synthetic.

The test-first red run failed because the adapter did not exist. The focused adapter suite passed 8/8 and the combined browser-adapter/control/transport suite passed 17/17. The full repository suite passed 282/282; candidate-matrix, control-template, degradation, Node syntax, JSON and diff checks also passed. Execution used only the isolated local x86_64 worktree, Node.js and disposable temporary files under a 20-minute lease. No RDC endpoint was contacted and no guest, process, disk, container, network, access control, API, billing setting or capacity changed. Recovery is a commit revert; no remote rollback is required.

The durable state remains unchanged: builder matrix `NO_ELIGIBLE_NODE`, userdebug artifact `NOT_BUILT`, and authenticated shell, live browser reconnect, semantic UI recovery, physical-phone control and R2 `NOT_PROVEN`. The next bounded task is to define a physical-Android observation adapter that consumes canonical Broccoli Rish evidence without copying or altering `broccoli-core/lib/rish_run.sh`, and keeps live device qualification separate from synthetic tests.

## Physical-Android Rish observation-adapter contract

Contract `ANDROID-CONTROL-PHYSICAL-RISH-20261008-13` is a repository-only change stacked on PR #178 commit `e3022cfd458fddc4ae7e7b33de5def4c339a96a1`. It adds an observation adapter for a digest-bound record produced through the canonical `onnxscibroccoli/broccoli-core:lib/rish_run.sh` boundary. Exact wrapper commit/blob identities, `RISH_PRESERVE_ENV=0`, source SHA, physical node, session, sequence, Android `uid=2000` and `u:r:shell:s0` are required.

The adapter contains no launcher and neither copies nor modifies the canonical wrapper. It never contacts a phone, runs Rish, dispatches input or replays an observed operation. The record digest is bound into the output operation identity, but wrapper provenance alone cannot prove a cloud-Android control action: delivery, visible acknowledgement, semantic effect, reconnect continuity, overall live acceptance and R2 all remain `NOT_PROVEN`. Historical phone evidence was not promoted because no fresh record was collected in this contract.

The test-first red run failed because the adapter did not exist. The focused adapter suite passed 9/9 and the combined adapter/control/transport suite passed 18/18. The full repository suite passed 291/291; candidate-matrix, control-template, degradation, Node syntax, JSON and diff checks also passed. Execution used only the isolated local x86_64 worktree, Node.js and disposable temporary files under a 20-minute lease. No RDC endpoint or physical phone was contacted and no guest, process, disk, container, network, access control, API, billing setting or capacity changed. Recovery is a commit revert; no remote rollback is required.

The durable state remains unchanged: builder matrix `NO_ELIGIBLE_NODE`, userdebug artifact `NOT_BUILT`, and authenticated shell, live browser reconnect, live physical-phone control, semantic UI recovery and R2 `NOT_PROVEN`. The next bounded task is a provider-neutral evidence-bundle index that composes workstation, browser and physical-Android records without allowing one transport's evidence to satisfy another transport's gate.

## Provider-neutral evidence-bundle index contract

Contract `ANDROID-CONTROL-EVIDENCE-BUNDLE-20261008-14` is repository-only and stacked on PR #179 commit `5f249b486f173d25412ad2ea57910af637052ca9`. It adds `grasshopper.android-control-evidence-bundle/v1`, a deterministic verifier and a fail-closed three-origin template. Each workstation, browser and physical-Android entry binds exact evidence bytes and SHA-256 together with the embedded source SHA, node, transport, origin and session.

The verifier rejects duplicate or missing origins, mixed source/session identity, node or transport substitution, missing/tampered evidence and collection-mode relabeling. It runs the existing control-evidence verifier on every entry but reports each origin's gates separately: no union or cross-origin upgrade exists. Bundle status, live acceptance and R2 are pinned to `NOT_PROVEN`, including for synthetically complete fixtures.

Test-first development recorded a failing 0/10 red run before the verifier existed. The focused suite then passed 10/10; the combined bundle/adapter/control/transport suite passed 28/28 and the full repository suite passed 301/301. Template verification, candidate inventory, degradation guard, Node syntax, JSON parsing and diff checks passed. Execution used only the isolated local x86_64 worktree with a 20-minute lease and disposable temporary files. No RDC endpoint, phone, guest, process, disk, network, access control, API, billing setting or capacity was contacted or changed. Recovery is a commit revert.

The durable state remains unchanged: builder matrix `NO_ELIGIBLE_NODE`, userdebug artifact `NOT_BUILT`, and authenticated shell, live browser reconnect, live physical-phone control, semantic UI recovery and R2 `NOT_PROVEN`. The next bounded task is a repository-only gap report that names missing gates per origin from a verified bundle without dispatching actions or combining evidence.
