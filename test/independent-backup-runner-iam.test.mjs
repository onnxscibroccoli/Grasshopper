import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, cp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  FORBIDDEN_S3_OBJECT_ACTIONS,
  extractIamActionsFromTf,
  findForbiddenBackupRunnerActions,
  assertBackupRunnerIamActions,
  validateIndependentBackupRunner
} from "../scripts/validate-independent-backup-runner.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = join(ROOT, "scripts", "validate-independent-backup-runner.mjs");
const MODULE = join(ROOT, "infra", "aws", "independent-backup-runner");

test("extractIamActionsFromTf parses quoted Action list tokens only", () => {
  const tf = `
    actions = [
      "s3:PutObject",
      "s3:AbortMultipartUpload"
    ]
    # prose mentioning s3:GetObject must not count
    # cannot read S3 backup objects
    actions = ["secretsmanager:GetSecretValue"]
  `;
  const actions = extractIamActionsFromTf(tf);
  assert.deepEqual(actions, [
    "s3:PutObject",
    "s3:AbortMultipartUpload",
    "secretsmanager:GetSecretValue"
  ]);
  assert.equal(actions.includes("s3:GetObject"), false);
});

test("s3:PutObject is not a false positive for s3:GetObject", () => {
  const actions = extractIamActionsFromTf('actions = ["s3:PutObject", "s3:ListBucket"]');
  assert.deepEqual(findForbiddenBackupRunnerActions(actions), []);
  assert.doesNotThrow(() => assertBackupRunnerIamActions('actions = ["s3:PutObject"]'));
});

test("forbidden S3 object actions are detected by exact quoted match", () => {
  for (const forbidden of FORBIDDEN_S3_OBJECT_ACTIONS) {
    const tf = `actions = ["s3:PutObject", "${forbidden}"]`;
    const found = findForbiddenBackupRunnerActions(extractIamActionsFromTf(tf));
    assert.deepEqual(found, [forbidden], forbidden);
    assert.throws(
      () => assertBackupRunnerIamActions(tf),
      /forbidden entries/,
      forbidden
    );
  }
});

test("any rds: action in Action lists fails", () => {
  for (const action of ["rds:DescribeDBInstances", "rds:ModifyDBInstance", "rds:*"]) {
    const tf = `actions = ["s3:PutObject", "${action}"]`;
    const found = findForbiddenBackupRunnerActions(extractIamActionsFromTf(tf));
    assert.ok(found.includes(action), action);
    assert.throws(() => assertBackupRunnerIamActions(tf), /forbidden entries/);
  }
});

test("README prose alone does not satisfy forbid asserts (TF parse required)", () => {
  const proseOnly = `
    # The role cannot read S3 backup objects, modify RDS
    # mentions s3:GetObject in comments only
  `;
  assert.deepEqual(extractIamActionsFromTf(proseOnly), []);
  assert.deepEqual(findForbiddenBackupRunnerActions([]), []);
});

test("live module main.tf Allow actions pass forbid checks", async () => {
  const main = await readFile(join(MODULE, "main.tf"), "utf8");
  const actions = assertBackupRunnerIamActions(main);
  assert.ok(actions.includes("s3:PutObject"));
  assert.equal(actions.includes("s3:GetObject"), false);
  assert.equal(actions.includes("s3:GetObjectVersion"), false);
  assert.equal(actions.includes("s3:DeleteObject"), false);
  assert.equal(actions.some((a) => /^rds:/i.test(a)), false);
});

test("validateIndependentBackupRunner passes on repository module", () => {
  const result = validateIndependentBackupRunner(MODULE);
  assert.equal(result.status, "PASS");
  assert.ok(result.parsedAllowActions.includes("s3:PutObject"));
});

test("CLI validate:independent-backup-runner exits 0 on clean module", () => {
  const run = spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    encoding: "utf8"
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const parsed = JSON.parse(run.stdout.trim());
  assert.equal(parsed.status, "PASS");
});

test("negative: injected s3:GetObject in Allow Action list fails closed", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bak-runner-iam-get-"));
  try {
    const mod = join(dir, "infra", "aws", "independent-backup-runner");
    await mkdir(mod, { recursive: true });
    await cp(MODULE, mod, { recursive: true });
    const mainPath = join(mod, "main.tf");
    let main = await readFile(mainPath, "utf8");
    main = main.replace(
      '"s3:PutObject",',
      '"s3:PutObject",\n      "s3:GetObject",'
    );
    await writeFile(mainPath, main);
    assert.throws(
      () => validateIndependentBackupRunner(mod),
      /s3:GetObject/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("negative: injected s3:DeleteObject fails closed", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bak-runner-iam-del-"));
  try {
    const mod = join(dir, "infra", "aws", "independent-backup-runner");
    await mkdir(mod, { recursive: true });
    await cp(MODULE, mod, { recursive: true });
    const mainPath = join(mod, "main.tf");
    let main = await readFile(mainPath, "utf8");
    main = main.replace(
      '"s3:AbortMultipartUpload"',
      '"s3:AbortMultipartUpload",\n      "s3:DeleteObject"'
    );
    await writeFile(mainPath, main);
    assert.throws(
      () => validateIndependentBackupRunner(mod),
      /s3:DeleteObject/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("negative: injected rds: action fails closed", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bak-runner-iam-rds-"));
  try {
    const mod = join(dir, "infra", "aws", "independent-backup-runner");
    await mkdir(mod, { recursive: true });
    await cp(MODULE, mod, { recursive: true });
    const mainPath = join(mod, "main.tf");
    let main = await readFile(mainPath, "utf8");
    main = main.replace(
      '"kms:Decrypt"',
      '"kms:Decrypt",\n      "rds:DescribeDBInstances"'
    );
    await writeFile(mainPath, main);
    assert.throws(
      () => validateIndependentBackupRunner(mod),
      /rds:DescribeDBInstances/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("negative: missing module file still fails closed", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bak-runner-iam-miss-"));
  try {
    const mod = join(dir, "infra", "aws", "independent-backup-runner");
    await mkdir(mod, { recursive: true });
    await writeFile(join(mod, "main.tf"), 'actions = ["s3:PutObject"]\n');
    assert.throws(
      () => validateIndependentBackupRunner(mod),
      /missing backup runner artifact/
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
