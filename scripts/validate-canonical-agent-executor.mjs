#!/usr/bin/env node
import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const root = process.cwd();
const paths = [
  "src/production/agent-executor.mjs",
  "reference/production/deployed/agent-executor.mjs"
];
const expectedSha = "d1ad94d942ebfd0898c79a18d649b5628bb7a31ce10cdbaf01cf57e4353758c2";
const expectedSize = 1056;

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
if (results[0].sha256 !== results[1].sha256) throw new Error("canonical executor adapter and evidence differ");
console.log(JSON.stringify({canonical:results[0],evidence:results[1],status:"byte-identical"},null,2));
