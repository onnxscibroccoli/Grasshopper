import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("agentic reproducibility verifier is fail-closed and production-independent", async () => {
  const script = await readFile("scripts/verify-agentic-reproducibility.sh", "utf8");
  assert.match(script, /git archive --format=tar/);
  assert.match(script, /working tree is dirty/);
  assert.match(script, /production_credentials_required=false/);
  assert.match(script, /live_production_mutation_performed=false/);
  assert.match(script, /source archive contains private-key material/);
  assert.match(script, /\*\.pem/);
  assert.match(script, /actions run 37885707040/);
});

test("public node-identity fixture does not use a private-material filename", async () => {
  const manifest = await readFile("docs/implementation/evidence/OCI_NODE_IDENTITY_ATTESTATION_TEMPLATE.json", "utf8");
  const pkg = await readFile("package.json", "utf8");
  assert.match(manifest, /OCI_NODE_IDENTITY_ATTESTATION_PUBLIC_KEY\.pub/);
  assert.doesNotMatch(manifest, /OCI_NODE_IDENTITY_ATTESTATION_PUBLIC_KEY\.pem/);
  assert.match(pkg, /OCI_NODE_IDENTITY_ATTESTATION_PUBLIC_KEY\.pub/);
  assert.doesNotMatch(pkg, /OCI_NODE_IDENTITY_ATTESTATION_PUBLIC_KEY\.pem/);
});
