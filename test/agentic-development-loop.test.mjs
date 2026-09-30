import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("OCI agent bootstrap keeps optional ripgrep non-fatal", async () => {
  const source = await readFile("scripts/oci-workstation-agent-bootstrap.sh", "utf8");

  assert.match(
    source,
    /sudo dnf -y install git curl jq openssh-clients ca-certificates tar gzip unzip/
  );
  assert.match(
    source,
    /WARN: ripgrep package is unavailable/
  );
  assert.doesNotMatch(
    source,
    /sudo dnf -y install .*ripgrep/
  );
});

test("agentic development workflow has a deterministic verification gate", async () => {
  const source = await readFile(
    ".github/workflows/agentic-development-loop.yml",
    "utf8"
  );

  assert.match(source, /npm test/);
  assert.match(source, /npm run validate:bist-schema/);
  assert.match(source, /npm run verify:agentic-control-plane/);
  assert.match(source, /npm run verify:agentic-reproducibility/);
  assert.match(source, /anthropics\/claude-code-action@v1/);
  assert.match(source, /contents: write/);
  assert.match(source, /pull-requests: write/);
  assert.match(source, /id-token: write/);
});
