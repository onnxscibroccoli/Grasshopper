#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { validateManifest } from "../lib/independent-backup-policy.mjs";

const [artifact, manifestFile] = process.argv.slice(2);
if (!artifact || !manifestFile) {
  console.error("usage: verify-independent-backup.mjs ARTIFACT MANIFEST");
  process.exit(2);
}
const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
validateManifest(manifest);
const bytes = await readFile(artifact);
const actual = createHash("sha256").update(bytes).digest("hex");
const size = (await stat(artifact)).size;
if (actual !== manifest.artifact_sha256) throw new Error("artifact SHA-256 mismatch");
if (size !== manifest.artifact_size) throw new Error("artifact size mismatch");
console.log(JSON.stringify({status:"PASS",artifact_sha256:actual,artifact_size:size,backup_id:manifest.backup_id}));
