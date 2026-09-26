#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const root = process.cwd();
const paths = [
  "src/production/agent-executor.mjs",
  "reference/production/deployed/agent-executor.mjs"
];
const expectedSha = "6c6346aee951eb139aa15fb7a5394bbd24bae5fab9a557a1f4f8d22d9ed3384e";

const results = [];
for (const relative of paths) {
  const full = join(root, relative);
  const body = await readFile(full);
  const sha = createHash("sha256").update(body).digest("hex");
  const st = await stat(full);
  if (sha !== expectedSha) throw new Error(`${relative}: SHA mismatch: ${sha}`);
  results.push({ path: relative, sha256: sha, sizeBytes: st.size });
}
if (results[0].sha256 !== results[1].sha256) throw new Error("canonical executor adapter and evidence differ");
console.log(JSON.stringify({canonical:results[0],evidence:results[1],status:"byte-identical"},null,2));
