import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOC = path.join(ROOT, "docs/USER_DATA_BOOTSTRAP_CONTRACT.md");
const OBSOLETE_TEST = path.join(ROOT, "test/full-remote-desktop-aws-stack.test.mjs");
const INFRA = path.join(ROOT, "infra");

function walkFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
      continue;
    }
    if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

test("obsolete SSM Association stack test is not present", () => {
  assert.equal(fs.existsSync(OBSOLETE_TEST), false);
});

test("Grasshopper infra does not declare AWS::SSM::Association", () => {
  const hits = [];
  for (const file of walkFiles(INFRA)) {
    const text = fs.readFileSync(file, "utf8");
    if (text.includes("AWS::SSM::Association")) {
      hits.push(path.relative(ROOT, file));
    }
  }
  assert.deepEqual(hits, []);
});

test("no remaining test requires AWS::SSM::Association as a stack resource", () => {
  const hits = [];
  for (const file of walkFiles(path.join(ROOT, "test"))) {
    if (path.basename(file) === "user-data-bootstrap-contract.test.mjs") {
      continue;
    }
    const text = fs.readFileSync(file, "utf8");
    if (text.includes("AWS::SSM::Association")) {
      hits.push(path.relative(ROOT, file));
    }
  }
  assert.deepEqual(hits, []);
});

test("user-data bootstrap contract is documented and does not alter production edge", () => {
  assert.equal(fs.existsSync(DOC), true);
  const text = fs.readFileSync(DOC, "utf8");
  assert.match(text, /user_data/);
  assert.match(text, /user-data\.sh/);
  assert.match(text, /AWS::SSM::Association/);
  assert.match(text, /must not restore/i);
  assert.match(text, /CloudFront -> nginx :80 -> Helix :8092/);
  assert.match(text, /operational/i);
  assert.doesNotMatch(text, /AGENT_TOKEN\s*[:=]\s*['"]?[A-Za-z0-9_-]{16,}/);
});
