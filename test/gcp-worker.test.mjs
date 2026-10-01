import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

test("GCP worker scripts exist and pass local syntax checks", () => {
  const shell = ["scripts/gcp/worker-bootstrap.sh"];
  for (const file of shell) {
    assert.ok(existsSync(file), file + " missing");
    execFileSync("bash", ["-n", file], { stdio: "inherit" });
  }
  assert.ok(existsSync("scripts/gcp/verify-worker.py"));
  execFileSync("python3", ["-m", "py_compile", "scripts/gcp/verify-worker.py"], { stdio: "inherit" });
});

test("GCP bootstrap is fail-closed on public exposure and GitHub egress", () => {
  const source = readFileSync("scripts/gcp/worker-bootstrap.sh", "utf8");
  assert.match(source, /access-configs\/0\/external-ip/);
  assert.match(source, /\[\[ "\$HTTP" == "404" \]\]/);
  assert.match(source, /api\.github\.com\/zen/);
  assert.match(source, /OMNIKALI_GITHUB_API_ONLY=1/);
  assert.match(source, /sha256sum -c/);
});

test("GCP worker verification requires source and persistent-index evidence", () => {
  const source = readFileSync("scripts/gcp/verify-worker.py", "utf8");
  assert.match(source, /worker-source\.json/);
  assert.match(source, /PRAGMA integrity_check/);
  assert.match(source, /github-index/);
  assert.match(source, /external_ipv4/);
});
