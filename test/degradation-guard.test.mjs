#!/usr/bin/env node
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { audit } from "../scripts/verify-no-broccoli-degradation.mjs";

function tree() {
  const root = mkdtempSync(join(tmpdir(), "degrade-"));
  mkdirSync(join(root, "docs"));
  writeFileSync(join(root, "docs/BROCCOLI_KNOWLEDGE_GRAPH.md"), "BROCCOLI-KG-2026-10-01\n");
  writeFileSync(join(root, "docs/BROCCOLI_IMPLEMENTATION_PHILOSOPHY.md"), "RISH_PRESERVE_ENV=0\n");
  writeFileSync(join(root, "docs/DEGRADATION_LESSONS.md"), "NOT_PROVEN\n");
  writeFileSync(
    join(root, "docs/PORTABILITY_AND_EXECUTION_BOUNDARIES.md"),
    "host and target shells are separate runtimes\n",
  );
  return root;
}

test("clean tree passes", () => {
  assert.deepEqual(audit(tree()), []);
});

test("root debris fails", () => {
  const root = tree();
  writeFileSync(join(root, "daemon.log"), "x");
  writeFileSync(join(root, "advance_step8_governor.sh"), "x");
  const failures = audit(root);
  assert.ok(failures.some((item) => item.includes("daemon.log")));
  assert.ok(failures.some((item) => item.includes("advance_step8_governor.sh")));
});

test("see-chat stub fails", () => {
  const root = tree();
  writeFileSync(join(root, "docs/ENGINEERING.md"), "# see chat ENGINEERING.md\n");
  assert.ok(audit(root).some((item) => item.startsWith("stub_doc:")));
});

test("PASS without artifact fetch fails", () => {
  const root = tree();
  writeFileSync(join(root, "docs/ANDROID_RDC_TERMUX_TRANSPORT_GATE_2026-10-01.md"), "Current state: PASS\n");
  assert.ok(audit(root).includes("false_pass:rdc_gate_without_artifact"));
});

test("copied rish wrapper fails", () => {
  const root = tree();
  mkdirSync(join(root, "lib"));
  writeFileSync(join(root, "lib/rish_run.sh"), "#!/bin/bash\n");
  assert.ok(audit(root).some((item) => item.startsWith("known_good_copied:")));
});
