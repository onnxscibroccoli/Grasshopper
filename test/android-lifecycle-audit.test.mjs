import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const script = fileURLToPath(new URL("../scripts/android-lifecycle-audit.sh", import.meta.url));
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "lifecycle-audit-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const home = join(root, "home");
  const bin = join(root, "bin");
  const cwd = join(root, "elsewhere");
  for (const dir of [home, bin, cwd]) mkdirSync(dir);
  const invoked = join(root, "unexpected-raw-rish");
  writeFileSync(join(bin, "rish"), `#!/bin/sh\ntouch '${invoked}'\nexit 0\n`, { mode: 0o755 });
  function run(extra = {}) {
    const result = spawnSync("bash", [script], {
      cwd, encoding: "utf8", timeout: 5000,
      env: { ...process.env, HOME: home, BROCCOLI_ROOT: "", PATH: `${bin}:${process.env.PATH}`, ...extra },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(invoked), false, "raw driver must never run");
    assert.doesNotMatch(result.stdout, /^RISH.*=PASS$/m);
    assert.match(result.stdout, /^RISH_TRANSPORT_HEALTH=NOT_PROVEN$/m);
    return result.stdout;
  }
  return { root, home, cwd, run };
}

test("raw rish on PATH cannot substitute for missing canonical wrapper", (t) => {
  const f = fixture(t);
  assert.match(f.run(), /^RISH_CANONICAL_WRAPPER=NOT_PROVEN$/m);
});

test("default canonical wrapper is AVAILABLE from unrelated working directory", (t) => {
  const f = fixture(t);
  const lib = join(f.home, "broccoli-core", "lib");
  mkdirSync(lib, { recursive: true });
  writeFileSync(join(lib, "rish_run.sh"), "exit 99\n", { mode: 0o644 });
  assert.match(f.run(), /^RISH_CANONICAL_WRAPPER=AVAILABLE$/m);
});

test("BROCCOLI_ROOT selects explicit canonical checkout without invoking transport", (t) => {
  const f = fixture(t);
  const checkout = resolve(f.root, "custom-core");
  mkdirSync(join(checkout, "lib"), { recursive: true });
  writeFileSync(join(checkout, "lib", "rish_run.sh"), "exit 99\n", { mode: 0o644 });
  assert.match(f.run({ BROCCOLI_ROOT: checkout }), /^RISH_CANONICAL_WRAPPER=AVAILABLE$/m);
});
