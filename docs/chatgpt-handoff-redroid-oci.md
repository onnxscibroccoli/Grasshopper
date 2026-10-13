# ChatGPT Handoff Prompt — Redroid Deployment on OCI (2026-10-13)

**Purpose:** Paste this entire document into a fresh ChatGPT session. It is self-contained: it tells ChatGPT who it is working for, what the goal is, where the source of truth lives, and exactly what to do. No prior conversation context is assumed.

---

## 1. Who you are working for

You are assisting Ian Cossette (GitHub: onnxscibroccoli, email: iccossett97@gmail.com, phone: 267-667-2321). Ian has a traumatic brain injury and uses AI agents as his primary technical workforce. He values: (1) evidence over claims — never report success without a verifiable artifact; (2) harm reduction and safety — never take destructive actions without explicit authorization; (3) persistence — tasks should complete fully, not stop at the first error.

Treat his time and cognitive load as the scarcest resource. Be direct, dense, and complete. Do not pad. Do not ask questions Ian can answer himself from the material below.

## 2. The goal

Deploy **redroid** (Remote Android) on Ian's Oracle Cloud Infrastructure (OCI) Always Free Ampere A1 instance so that a persistent, containerized Android environment exists in the cloud. This Android instance will serve as a secure mirror of Ian's accounts for agentic automation — authentication sessions live in the container, not on his personal phone. Speed is not the priority; persistence and isolation are.

**Why redroid and not QEMU:** Ian's prior Android emulation attempts on OCI failed because the Ampere A1 host does not expose /dev/kvm, forcing QEMU TCG software emulation (~12x slowdown for aarch64 guests, per Linaro measurements). redroid runs Android as a container directly on the host Linux kernel using binderfs and ashmem — no KVM required. Android's runtime (ART) is already a virtual machine that executes DEX bytecode, so no second hypervisor layer is needed. This is the correct substrate for the use case.

**Target host:** OCI Always Free Ampere A1, Ubuntu 24.04 aarch64, kernel 6.17.0-1007-oracle. Allocation: 2 OCPU / 12 GB RAM (Oracle quietly cut the old 4/24 legend — verified 2026-10-08). One redroid instance is fine; multiple will be tight on memory.

## 3. Source of truth (read these first, in order)

All of Ian's project documentation lives in public GitHub repos under onnxscibroccoli. Read before acting:

1. **https://github.com/onnxscibroccoli/Grasshopper/blob/main/docs/redroid-implementation-log.md** — the implementation log: upstream repos, OCI-specific notes, deploy sketch, open items. This is the primary spec.
2. **https://github.com/onnxscibroccoli/trash/blob/cleanup/oci-storage-2026-10/NOTES.md** — OCI storage cleanup checklist (related: junk from failed QEMU attempts should be moved to the trash repo before deleting locally).
3. **https://github.com/remote-android/redroid-doc** — upstream redroid documentation, deploy guides, issue tracker.
4. **https://github.com/remote-android/redroid-modules** — kernel modules for binderfs/ashmem. **Critical:** there is an open PR (#21, kernel 6.8+ support) and a follow-up patch comment validating a full Android 16 boot on kernel 6.17.0-1007-oracle aarch64. Use the PR branch if main does not build on this kernel.
5. Docker Hub: https://hub.docker.com/r/redroid/redroid — official images, multi-arch. Use `redroid/redroid:16.0.0_64only-latest` for arm64 (or `16.0.0-latest` which is also multi-arch).

## 4. Authentication workflow (OCI)

Ian does not have OCI API keys or an OCI CLI config pre-installed on any machine you control. Authentication must be established interactively with Ian. Follow this order:

**Step A — Discover what exists.** Ask Ian (or check if you have shell access to any machine with OCI config): does `~/.oci/config` exist anywhere? Is the OCI CLI installed? Does Ian have an API key pair uploaded to his OCI console (Identity > API Keys)?

**Step B — If nothing exists, guide Ian to create credentials in the OCI Console:**
1. Log in at https://cloud.oracle.com (region: check which home region Ian's tenancy uses — likely us-ashburn-1 or us-phoenix-1; ask).
2. Profile icon > My Profile > API Keys > Add API Key. Generate a key pair; download the private key PEM. Note the key fingerprint.
3. Create or reuse an OCI user with appropriate policy. For Always Free compartment operations, a policy like: `Allow group <group> to manage all-resources in compartment id <compartment-ocid>` (scoped as narrowly as Ian approves).
4. Tenancy OCID and user's OCID are visible in the console (Profile > Tenancy info / user profile).
5. Write `~/.oci/config` in the standard format:
   ```
   [DEFAULT]
   user=<user-ocid>
   fingerprint=<key-fingerprint>
   tenancy=<tenancy-ocid>
   region=<home-region>
   key_file=~/.oci/config_api_key.pem
   ```
   Place the private key at the referenced path with 600 permissions.

**Step C — Verify.** Run `oci iam region list` (or `oci compute instance list --compartment-id <compartment-ocid>`). If this returns data, authentication works. Do not proceed to mutations until Step C passes.

**Step D — Locate the target instance.** List compute instances in the Always Free compartment. Identify the Ampere A1 instance (shape VM.Standard.A1.Flex) running Ubuntu 24.04. Record its OCID and public IP.

**Step E — Establish shell access to the instance.** Preferred: OCI Cloud Shell from the console (no SSH key management needed). Alternative: SSH from a machine Ian controls using his existing key pair. If Ian's SSH key is not on the instance, guide him to add it via the OCI Console (Compute > Instance > Attached VNICs > VNIC > IPv4 Addresses > Add SSH key) or via the metadata/cloud-init path.

**IMPORTANT:** Never store API keys, private keys, or passwords in GitHub repos, chat logs, or any committed file. Keys live only in `~/.oci/` on the machine performing operations, with 600 permissions. If you ever need to reference a credential in a document, use a placeholder like `<REDACTED>`.

## 5. Execution plan (what to do once authenticated and on the host)

Work through these in order. After each step, produce a verifiable artifact (command output, file listing, or screenshot description) before moving on. If a step fails, diagnose from the error — do not skip ahead or claim partial success.

**Phase 1 — Host inventory (non-destructive).**
- `uname -r` (confirm 6.17.0-1007-oracle or note deviation)
- `nproc`, `free -h`, `df -h` (confirm 2 CPU / 12 GB / storage headroom)
- `docker --version` (install Docker if absent: official convenience script or apt)
- `lsmod | grep -E 'binder|ashmem'` (expect: nothing yet)
- Check for leftover QEMU/AVD junk from prior failed emulation: `du -sh /var/lib/libvirt /home/*/.android /opt/android* 2>/dev/null`. If found, flag for the storage cleanup (Phase 5) — do not delete yet.

**Phase 2 — Kernel modules.**
- Clone https://github.com/remote-android/redroid-modules
- Try `make && sudo make install` on main. If it fails on this kernel, switch to the PR #21 branch (kernel 6.8+ support) or the follow-up patch noted in the implementation log.
- `sudo modprobe ashmem_linux` and `sudo modprobe binder_linux devices=binder,hwbinder,vndbinder`
- **Verify:** `ls -l /dev/binder /dev/ashmem /dev/hwbinder /dev/vndbinder` must all exist. This is the gate. Do not proceed without it.
- Fallback if ashmem module fails: redroid supports `androidboot.use_memfd=1` (uses memfd instead of ashmem). Note this in the run log.

**Phase 3 — Boot redroid.**
- `docker pull redroid/redroid:16.0.0_64only-latest` (arm64)
- Run:
  ```bash
  docker run -itd --rm --privileged --pull always \
    -v ~/redroid-data:/data \
    -p 5555:5555 \
    --name redroid \
    redroid/redroid:16.0.0_64only-latest
  ```
- **Verify:** `adb connect <public-ip>:5555` succeeds; `adb shell getprop ro.build.version.release` returns 16; scrcpy (if available) shows a home screen. Boot may take several minutes on 2 OCPU — be patient, poll rather than declaring failure early.
- Note: no Play Store by default. For account-mirroring this is acceptable. GMS can be layered later if Ian requests it.

**Phase 4 — Wire into Grasshopper.**
- Ian's Grasshopper repo (https://github.com/onnxscibroccoli/Grasshopper) has a cloud-android adapter path and lifecycle scripts. Add redroid start/stop/snapshot commands to that adapter so the agentic control plane can manage the container. Follow existing patterns in the repo (see worker-network/ and the agentic-development-loop workflow for conventions).
- Commit to a feature branch, open a PR. Do not merge to main without Ian's approval.

**Phase 5 — Storage cleanup.**
- Move identified junk (Phase 1) to https://github.com/onnxscibroccoli/trash on branch `cleanup/oci-storage-2026-10` (NOTES.md on that branch has the checklist). Delete local copies only after the GitHub commit is confirmed.
- `docker system prune -af` for unused images/containers.
- Re-check `df -h`.

## 6. Reporting back

When done (or blocked), report to Ian with:
1. What was done, step by step, with command outputs as evidence.
2. What is still open (from the implementation log's Open Items list).
3. Any deviations from this plan and why.
4. Exact next action for Ian (e.g., "approve PR #N", "add SSH key to instance", "paste API key fingerprint").

Ian will relay results to his other agents (Grok, Gemini) as needed. Keep the report factual and artifact-backed.

## 7. Guardrails

- No destructive commands (rm -rf, docker rm of non-redroid containers, volume deletion) without Ian's explicit go-ahead in that session.
- No billing changes, no instance resizing, no new paid resources. Always Free only.
- No credentials in any file that gets committed to GitHub.
- If you are unsure about a step, say so and ask — a wrong mutation on Ian's only cloud host costs more than a question.
- Ian's TBI means he may restate or re-ask; answer patiently without condescension.
