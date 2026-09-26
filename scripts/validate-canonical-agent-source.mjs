#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const root = process.cwd();
const paths = [
  "src/production/omni-agent.mjs",
  "reference/production/deployed/omni-agent.mjs"
];
const expectedSha = "ffd3d5981cb8cc749cb112d312018b119c95e5613376f1695c59e226aed9b349";
const expectedSize = 4223;

const results = [];
for (const relative of paths) {
  const full = join(root, relative);
  const body = await readFile(full);
  const sha = createHash("sha256").update(body).digest("hex");
  const st = await stat(full);
  if (sha !== expectedSha) throw new Error(`${relative}: SHA mismatch: ${sha}`);
  if (st.size !== expectedSize) throw new Error(`${relative}: size mismatch: ${st.size}`);
  results.push({ path: relative, sha256: sha, sizeBytes: st.size });
}

if (results[0].sha256 !== results[1].sha256) {
  throw new Error("canonical source and recovered production evidence differ");
}

console.log(JSON.stringify({
  canonical: results[0],
  evidence: results[1],
  status: "byte-identical"
}, null, 2));
