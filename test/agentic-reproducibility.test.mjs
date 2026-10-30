import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("agentic reproducibility verifier is fail-closed and production-independent", async () => {
  const script = await readFile("scripts/verify-agentic-reproducibility.sh", "utf8");
  assert.match(script, /git archive --format=tar/);
  assert.match(script, /working tree is dirty/);
  assert.match(script, /production_credentials_required=false/);
  assert.match(script, /live_production_mutation_performed=false/);
  assert.match(script, /\.grasshopper\/audit\/reproducibility/);
  assert.match(script, /emit-agentic-reproducibility-evidence\.mjs/);
});
