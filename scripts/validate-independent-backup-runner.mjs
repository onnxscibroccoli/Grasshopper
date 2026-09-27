import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = "infra/aws/independent-backup-runner";
const required = ["providers.tf", "variables.tf", "main.tf", "outputs.tf", "README.md"];

/** Explicit S3 object actions the backup runner must never be Allowed. */
export const FORBIDDEN_S3_OBJECT_ACTIONS = Object.freeze([
  "s3:GetObject",
  "s3:GetObjectVersion",
  "s3:DeleteObject"
]);

/**
 * Extract quoted IAM Action strings from Terraform `actions = [...]` lists only.
 * Does not read README prose. Matches "service:Action" / "service:Action*" forms.
 * Exact quoted-action tokens avoid false positives (e.g. s3:PutObject vs s3:GetObject).
 */
export function extractIamActionsFromTf(tfSource) {
  if (typeof tfSource !== "string") throw new Error("tfSource must be a string");
  const actions = [];
  const blockRe = /actions\s*=\s*\[([^\]]*)\]/g;
  let block;
  while ((block = blockRe.exec(tfSource)) !== null) {
    const actionRe = /"([a-z0-9-]+:[A-Za-z0-9*]+)"/g;
    let match;
    while ((match = actionRe.exec(block[1])) !== null) {
      actions.push(match[1]);
    }
  }
  return actions;
}

/**
 * Return forbidden Allow actions present in the parsed Action list.
 * - Exact match for s3:GetObject / s3:GetObjectVersion / s3:DeleteObject
 * - Any action whose service prefix is rds:
 */
export function findForbiddenBackupRunnerActions(actions) {
  if (!Array.isArray(actions)) throw new Error("actions must be an array");
  const found = [];
  for (const action of actions) {
    if (FORBIDDEN_S3_OBJECT_ACTIONS.includes(action)) {
      found.push(action);
      continue;
    }
    if (/^rds:/i.test(action)) {
      found.push(action);
    }
  }
  return found;
}

export function assertBackupRunnerIamActions(tfSource) {
  const actions = extractIamActionsFromTf(tfSource);
  const forbidden = findForbiddenBackupRunnerActions(actions);
  if (forbidden.length > 0) {
    throw new Error(
      "backup runner IAM Allow actions include forbidden entries (parsed from Terraform Action lists): " +
        forbidden.join(", ")
    );
  }
  return actions;
}

export function validateIndependentBackupRunner(moduleRoot = root) {
  for (const file of required) {
    if (!fs.existsSync(moduleRoot + "/" + file)) {
      throw new Error("missing backup runner artifact: " + moduleRoot + "/" + file);
    }
  }

  const variables = fs.readFileSync(moduleRoot + "/variables.tf", "utf8");
  const main = fs.readFileSync(moduleRoot + "/main.tf", "utf8");
  const readme = fs.readFileSync(moduleRoot + "/README.md", "utf8");
  const haystack = variables + "\n" + main + "\n" + readme;

  const requiredTokens = [
    ["dedicated secret input", /variable\s+"secret_arn"/],
    ["dedicated bucket input", /variable\s+"bucket_arn"/],
    ["KMS input", /variable\s+"kms_key_arn"/],
    ["Secrets Manager read", /secretsmanager:GetSecretValue/],
    ["S3 write only", /s3:PutObject/],
    ["no S3 object read", /cannot read S3 backup objects/],
    ["KMS data key permission", /kms:GenerateDataKey/],
    ["EC2 workload trust", /ec2.amazonaws.com/],
    ["no RDS permission", /cannot read S3 backup objects, modify RDS/],
    ["TF Action-list assertions", /asserts against Terraform IAM Action lists/]
  ];

  for (const [label, pattern] of requiredTokens) {
    if (!pattern.test(haystack)) throw new Error("backup runner IAM contract missing: " + label);
  }

  // Fail-closed against actual IAM Action lists in main.tf (not README prose alone).
  const parsedActions = assertBackupRunnerIamActions(main);

  if (/password\s*=\s*["'][^"']+["']/.test(main)) {
    throw new Error("literal credential detected in backup runner IAM Terraform");
  }

  return {
    status: "PASS",
    module: moduleRoot,
    permissionBoundary: "secret-read + prefix-write + KMS data-key",
    parsedAllowActions: parsedActions,
    forbiddenDenied: [...FORBIDDEN_S3_OBJECT_ACTIONS, "rds:*"],
    productionActivation: "not-applied"
  };
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const result = validateIndependentBackupRunner();
  console.log(JSON.stringify({
    status: result.status,
    module: result.module,
    permissionBoundary: result.permissionBoundary,
    productionActivation: result.productionActivation
  }));
}
