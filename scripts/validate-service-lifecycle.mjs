import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const contractPath = resolve(root, "docs/SERVICE_LIFECYCLE_CONTRACT.md");
const text = await readFile(contractPath, "utf8");

const required = [
  "# Production service lifecycle contract",
  "## Required lifecycle capabilities",
  "## Gateway requirements",
  "## Worker requirements",
  "## Ordering",
  "## Manifest boundary",
  "## Security rules",
  "## Compatibility rule",
  "## Current status"
];

for (const heading of required) {
  if (!text.includes(heading)) {
    throw new Error(`service lifecycle contract missing required section: ${heading}`);
  }
}

const forbidden = [
  /password\s*[:=]\s*\S+/i,
  /access[_ -]?token\s*[:=]\s*\S+/i,
  /session[_ -]?cookie\s*[:=]\s*\S+/i,
  /-----BEGIN [A-Z ]+PRIVATE KEY-----/
];

for (const pattern of forbidden) {
  if (pattern.test(text)) {
    throw new Error(`service lifecycle contract contains a credential-bearing value: ${pattern}`);
  }
}

console.log(JSON.stringify({
  status: "PASS",
  contract: "docs/SERVICE_LIFECYCLE_CONTRACT.md",
  requiredSections: required.length,
  credentialScan: "passed"
}, null, 2));
