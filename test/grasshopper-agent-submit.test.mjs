import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const script = await readFile(new URL("../scripts/grasshopper-agent-submit.sh", import.meta.url), "utf8");

test("autonomous submit helper is shell-valid", () => {
  execFileSync("bash", ["-n", new URL("../scripts/grasshopper-agent-submit.sh", import.meta.url).pathname]);
});

test("submit helper delegates merge authority to GitHub Actions", () => {
  assert.match(script, /git push --set-upstream origin/);
  assert.match(script, /gh pr create/);
  assert.match(script, /GITHUB_MERGE=DELEGATED_TO_ACTIONS/);
  assert.doesNotMatch(script, /gh pr merge/);
  assert.doesNotMatch(script, /merge_pull_request/);
});

test("submit helper requires local tests before push", () => {
  assert.match(script, /bash -lc "\$TEST_COMMAND"/);
  assert.match(script, /git diff --cached --quiet/);
  assert.match(script, /git commit -m "\$TITLE"/);
});
