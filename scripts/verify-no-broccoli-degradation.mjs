#!/usr/bin/env node
// Fails closed on the patterns that degraded broccoli-core.
import fs from "node:fs";
import path from "node:path";

const rootBanned = [
  /\.log$/,
  /\.pid$/,
  /\.bak(\.)?/,
  /^advance_step.*\.sh$/,
  /\.docx$/,
];

const required = [
  ["docs/BROCCOLI_KNOWLEDGE_GRAPH.md", "BROCCOLI-KG-2026-10-01"],
  ["docs/BROCCOLI_IMPLEMENTATION_PHILOSOPHY.md", "RISH_PRESERVE_ENV=0"],
  ["docs/DEGRADATION_LESSONS.md", "NOT_PROVEN"],
  ["docs/PORTABILITY_AND_EXECUTION_BOUNDARIES.md", "host and target shells are separate runtimes"],
];

export function audit(root) {
  const failures = [];
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (rootBanned.some((rule) => rule.test(entry.name))) {
      failures.push(`root_debris:${entry.name}`);
    }
  }

  const docs = path.join(root, "docs");
  if (fs.existsSync(docs)) {
    for (const name of fs.readdirSync(docs)) {
      if (!name.endsWith(".md")) continue;
      const text = fs.readFileSync(path.join(docs, name), "utf8");
      if (/^#\s*see chat\b/im.test(text) || text.trim() === "# see chat ENGINEERING.md") {
        failures.push(`stub_doc:docs/${name}`);
      }
      if (/PLACEHOLDER/i.test(text) && /shipped/i.test(text)) {
        failures.push(`false_shipped:docs/${name}`);
      }
    }
  }

  for (const [rel, marker] of required) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) {
      failures.push(`missing:${rel}`);
      continue;
    }
    const text = fs.readFileSync(file, "utf8");
    if (!text.includes(marker)) failures.push(`marker:${rel}:${marker}`);
  }

  const gate = path.join(root, "docs/ANDROID_RDC_TERMUX_TRANSPORT_GATE_2026-10-01.md");
  if (fs.existsSync(gate)) {
    const text = fs.readFileSync(gate, "utf8");
    if (/Current state:\s*PASS/i.test(text) && !/ARTIFACT_FETCHED=yes/.test(text)) {
      failures.push("false_pass:rdc_gate_without_artifact");
    }
  }

  const wrappers = ["lib/rish_run.sh", "rish_run.sh"].filter((rel) => fs.existsSync(path.join(root, rel)));
  if (wrappers.length > 0) failures.push(`known_good_copied:${wrappers.join(",")}`);

  return failures;
}

const isMain = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));
if (isMain) {
  const target = process.argv[2] || process.cwd();
  const failures = audit(target);
  if (failures.length) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exit(1);
  }
  console.log("PASS broccoli_degradation_guard");
}
