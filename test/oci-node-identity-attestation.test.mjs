import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const verifier = path.join(root, "scripts/cloud-android/verify-oci-node-identity-attestation.mjs");
const fixedAt = "2026-10-09T04:35:00Z";

function sha(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }

function fixture(mutator = () => {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grasshopper-node-attestation-"));
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const publicBytes = Buffer.from(publicKey.export({ type: "spki", format: "pem" }));
  const claims = {
    schema: "grasshopper.oci-node-identity-claims/v1",
    collection_mode: "TEST_FIXTURE",
    observed_utc: "2026-10-09T04:30:00Z",
    expires_utc: "2026-10-09T04:45:00Z",
    rdc_device_id: "0852e6f4-2507-4d0f-9d62-f6eda8cdd169",
    hostname: "grasshopper-workstation",
    architecture: "aarch64",
    provider: "OCI",
    shape: "VM.Standard.A1.Flex",
    region: "us-ashburn-1",
    instance_id: "ocid1.instance.oc1.iad.syntheticfixture"
  };
  const claimsFile = path.join(dir, "claims.json");
  fs.writeFileSync(claimsFile, `${JSON.stringify(claims, null, 2)}\n`);
  const claimsBytes = fs.readFileSync(claimsFile);
  const keyFile = path.join(dir, "attestor-public.pem");
  fs.writeFileSync(keyFile, publicBytes);
  const manifest = {
    schema: "grasshopper.node-identity-attestation/v1",
    contract_id: "TEST-NODE-IDENTITY-ATTESTATION",
    collection_mode: "TEST_FIXTURE",
    issued_utc: "2026-10-09T04:31:00Z",
    claims: { path: "claims.json", bytes: claimsBytes.length, sha256: sha(claimsBytes) },
    provenance: {
      source_kind: "OCI_INSTANCE_METADATA_V2",
      source_uri: "http://169.254.169.254/opc/v2/instance/",
      acquisition_boundary: "PREPROVISIONED_READ_ONLY_ATTESTOR",
      collector_sha256: "a".repeat(64)
    },
    signature: {
      algorithm: "ED25519",
      public_key_path: "attestor-public.pem",
      public_key_sha256: sha(publicBytes),
      value_base64: crypto.sign(null, claimsBytes, privateKey).toString("base64")
    },
    execution_mode: "NON_EXECUTABLE_VERIFICATION",
    shell_required: false,
    identity_qualified: false,
    live_acceptance: false,
    r2: "NOT_PROVEN"
  };
  mutator({ manifest, claims, claimsFile, keyFile, dir, privateKey, publicBytes });
  const manifestFile = path.join(dir, "manifest.json");
  fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  return { dir, manifestFile, claimsFile, keyFile, publicKeySha256: sha(publicBytes) };
}

function run(f, at = fixedAt) {
  return spawnSync(process.execPath, [verifier, f.manifestFile, f.claimsFile, f.keyFile,
    "--at", at,
    "--trusted-key-sha256", f.publicKeySha256,
    "--expect-device", "0852e6f4-2507-4d0f-9d62-f6eda8cdd169",
    "--expect-hostname", "grasshopper-workstation",
    "--expect-architecture", "aarch64",
    "--expect-provider", "OCI",
    "--expect-shape", "VM.Standard.A1.Flex"
  ], { cwd: root, encoding: "utf8" });
}

function withFixture(mutator, assertion) {
  const f = fixture(mutator);
  try { assertion(f); } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
}

test("valid signed fixture remains identity-unqualified", () => {
  withFixture(() => {}, (f) => {
    const result = run(f);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.signature, "PASS");
    assert.equal(report.identity_status, "TEST_FIXTURE_NOT_QUALIFIED");
    assert.equal(report.shell_required, false);
    assert.equal(report.r2, "NOT_PROVEN");
  });
});

test("trusted fresh LIVE attestation qualifies only node identity", () => {
  withFixture(({ manifest, claims, claimsFile, privateKey }) => {
    claims.collection_mode = "LIVE";
    fs.writeFileSync(claimsFile, `${JSON.stringify(claims, null, 2)}\n`);
    const bytes = fs.readFileSync(claimsFile);
    manifest.collection_mode = "LIVE";
    manifest.claims.bytes = bytes.length;
    manifest.claims.sha256 = sha(bytes);
    manifest.signature.value_base64 = crypto.sign(null, bytes, privateKey).toString("base64");
  }, (f) => {
    const result = run(f);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.identity_status, "LIVE_IDENTITY_QUALIFIED");
    assert.equal(report.identity_qualified, true);
    assert.equal(report.collection_authorized, false);
    assert.equal(report.live_acceptance, false);
    assert.equal(report.r2, "NOT_PROVEN");
  });
});

test("tampered claims fail signature verification", () => {
  withFixture(() => {}, (f) => {
    fs.appendFileSync(f.claimsFile, " \n");
    const result = run(f);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /claims byte count mismatch|claims digest mismatch|signature/);
  });
});

test("untrusted signing key fails closed", () => {
  withFixture(() => {}, (f) => {
    f.publicKeySha256 = "f".repeat(64);
    const result = run(f);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /trusted key/);
  });
});

test("node or provider substitution fails expected identity", () => {
  withFixture(({ claims, claimsFile, manifest }) => {
    claims.shape = "VM.Standard.E4.Flex";
    fs.writeFileSync(claimsFile, `${JSON.stringify(claims, null, 2)}\n`);
    const bytes = fs.readFileSync(claimsFile);
    manifest.claims.bytes = bytes.length;
    manifest.claims.sha256 = sha(bytes);
  }, (f) => {
    const result = run(f);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /shape mismatch|signature/);
  });
});

test("expired or future claims fail closed", () => {
  withFixture(() => {}, (f) => {
    const result = run(f, "2026-10-09T04:45:01Z");
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /expired/);
  });
});

test("manifest rejects executable fields", () => {
  withFixture(({ manifest }) => { manifest.command = "curl metadata"; }, (f) => {
    const result = run(f);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /schema invalid.*command/);
  });
});

test("repository template verifies without qualifying identity", () => {
  const result = spawnSync("npm", ["run", "verify:oci-node-identity-attestation"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout.trim().split("\n").at(-1));
  assert.equal(report.identity_status, "TEST_FIXTURE_NOT_QUALIFIED");
  assert.equal(report.identity_qualified, false);
});
