#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectEnvironment } from "../src/environment/detect.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas/environment-context.schema.json"), "utf8"));

for (const kind of schema.properties.kind.enum) {
  const file = path.join(root, "environments", kind + ".json");
  assert.ok(fs.existsSync(file), "missing environment config: " + kind);
  const config = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(config.schema, "omnikali.environment/v1");
  assert.match(config.version, /^\d+\.\d+\.\d+$/);
  assert.equal(config.kind, kind);
}

const detected = detectEnvironment({ GRASSHOPPER_ENV: "grasshopper-workstation", PREFIX: "" });
assert.equal(detected.kind, "grasshopper-workstation");
console.log(JSON.stringify({ status: "PASS", detected: detected.kind, environments: schema.properties.kind.enum }, null, 2));
