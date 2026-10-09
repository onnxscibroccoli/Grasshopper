#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { validateJsonSchemaSubset } from "../validate-json-schema-subset.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const schemaFile = path.join(root, "schemas/grasshopper-node-identity-attestation-v1.schema.json");
const minute = 60 * 1000;
const claimKeys = ["architecture", "collection_mode", "expires_utc", "hostname", "instance_id", "observed_utc", "provider", "rdc_device_id", "region", "schema", "shape"];

function sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function milliseconds(value, label) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} is not a valid timestamp`);
  return parsed;
}
function basenameOnly(value, label) {
  if (path.basename(value) !== value || value === "." || value === "..") throw new Error(`${label} must be a basename`);
}
function exactClaims(claims) {
  if (!claims || typeof claims !== "object" || Array.isArray(claims)) throw new Error("claims must be an object");
  const keys = Object.keys(claims).sort();
  if (keys.length !== claimKeys.length || keys.some((key, index) => key !== claimKeys[index])) throw new Error("claims fields are not exact");
  if (claims.schema !== "grasshopper.oci-node-identity-claims/v1") throw new Error("claims schema mismatch");
  if (!["LIVE", "TEST_FIXTURE"].includes(claims.collection_mode)) throw new Error("claims collection mode invalid");
  for (const key of ["rdc_device_id", "hostname", "architecture", "provider", "shape", "region", "instance_id"]) {
    if (typeof claims[key] !== "string" || !claims[key]) throw new Error(`${key} is required`);
  }
}

export function verifyNodeIdentityAttestation(manifest, claims, manifestDir, claimsBytes, publicKeyBytes, evaluatedAt, expected) {
  const schema = JSON.parse(fs.readFileSync(schemaFile, "utf8"));
  const errors = validateJsonSchemaSubset(schema, manifest);
  if (errors.length) throw new Error(`schema invalid: ${errors.join("; ")}`);
  exactClaims(claims);
  basenameOnly(manifest.claims.path, "claims path");
  basenameOnly(manifest.signature.public_key_path, "public key path");
  if (manifest.claims.bytes !== claimsBytes.length) throw new Error("claims byte count mismatch");
  if (manifest.claims.sha256 !== sha256(claimsBytes)) throw new Error("claims digest mismatch");
  if (manifest.signature.public_key_sha256 !== sha256(publicKeyBytes)) throw new Error("public key digest mismatch");
  if (manifest.signature.public_key_sha256 !== expected.trustedKeySha256) throw new Error("trusted key fingerprint mismatch");
  let publicKey;
  try { publicKey = crypto.createPublicKey(publicKeyBytes); }
  catch { throw new Error("public key is invalid"); }
  let signature;
  try { signature = Buffer.from(manifest.signature.value_base64, "base64"); }
  catch { throw new Error("signature encoding invalid"); }
  if (!signature.length || !crypto.verify(null, claimsBytes, publicKey, signature)) throw new Error("signature verification failed");
  if (manifest.collection_mode !== claims.collection_mode) throw new Error("collection mode mismatch");

  const comparisons = {
    rdc_device_id: expected.device,
    hostname: expected.hostname,
    architecture: expected.architecture,
    provider: expected.provider,
    shape: expected.shape,
  };
  for (const [field, wanted] of Object.entries(comparisons)) {
    if (claims[field] !== wanted) throw new Error(`${field.replace("rdc_device_id", "device")} mismatch`);
  }

  const observed = milliseconds(claims.observed_utc, "claims observation");
  const issued = milliseconds(manifest.issued_utc, "issue time");
  const expires = milliseconds(claims.expires_utc, "claims expiry");
  const at = milliseconds(evaluatedAt, "evaluation time");
  if (observed > issued) throw new Error("claims observation follows issue time");
  if (issued - observed > 5 * minute) throw new Error("claims observation is older than 5 minutes at issue time");
  if (expires <= issued) throw new Error("claims expiry must follow issue time");
  if (expires - observed > 20 * minute) throw new Error("claims validity exceeds 20 minutes");
  if (at < issued) throw new Error("attestation is not yet valid");
  if (at > expires) throw new Error("attestation expired");

  const qualified = manifest.collection_mode === "LIVE";
  return {
    schema: "grasshopper.node-identity-attestation-evaluation/v1",
    evaluated_at: evaluatedAt,
    signature: "PASS",
    provenance: "PASS_BOUND_OCI_IMDS_V2",
    identity_status: qualified ? "LIVE_IDENTITY_QUALIFIED" : "TEST_FIXTURE_NOT_QUALIFIED",
    identity_qualified: qualified,
    node: Object.fromEntries(Object.keys(comparisons).map((key) => [key, claims[key]])),
    evidence_sha256: manifest.claims.sha256,
    shell_required: false,
    collection_authorized: false,
    live_acceptance: false,
    r2: "NOT_PROVEN"
  };
}

function parseArgs(argv) {
  if (argv.length !== 17 || argv[3] !== "--at" || argv[5] !== "--trusted-key-sha256" || argv[7] !== "--expect-device" || argv[9] !== "--expect-hostname" || argv[11] !== "--expect-architecture" || argv[13] !== "--expect-provider" || argv[15] !== "--expect-shape") {
    throw new Error("usage: verifier MANIFEST CLAIMS PUBLIC_KEY --at ISO --trusted-key-sha256 SHA --expect-device ID --expect-hostname NAME --expect-architecture ARCH --expect-provider PROVIDER --expect-shape SHAPE");
  }
  return { at: argv[4], trustedKeySha256: argv[6], device: argv[8], hostname: argv[10], architecture: argv[12], provider: argv[14], shape: argv[16] };
}

function main(argv) {
  try {
    const expected = parseArgs(argv);
    const manifestFile = path.resolve(argv[0]);
    const claimsFile = path.resolve(argv[1]);
    const publicKeyFile = path.resolve(argv[2]);
    if (path.dirname(claimsFile) !== path.dirname(manifestFile) || path.dirname(publicKeyFile) !== path.dirname(manifestFile)) {
      throw new Error("attestation artifacts must share one directory");
    }
    const manifestBytes = fs.readFileSync(manifestFile);
    const claimsBytes = fs.readFileSync(claimsFile);
    const publicKeyBytes = fs.readFileSync(publicKeyFile);
    const manifest = JSON.parse(manifestBytes.toString("utf8"));
    const claims = JSON.parse(claimsBytes.toString("utf8"));
    if (manifest.claims?.path !== path.basename(claimsFile)) throw new Error("claims path mismatch");
    if (manifest.signature?.public_key_path !== path.basename(publicKeyFile)) throw new Error("public key path mismatch");
    const report = verifyNodeIdentityAttestation(manifest, claims, path.dirname(manifestFile), claimsBytes, publicKeyBytes, expected.at, expected);
    process.stdout.write(`${JSON.stringify(report)}\n`);
    return 0;
  } catch (error) {
    console.error(`FAIL oci_node_identity_attestation ${error.message}`);
    return 2;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) process.exit(main(process.argv.slice(2)));
