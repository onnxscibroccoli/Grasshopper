import fs from "node:fs";

const root = "infra/aws/control-plane-db";
const required = ["providers.tf", "variables.tf", "main.tf", "outputs.tf", "README.md"];

for (const file of required) {
  if (!fs.existsSync(root + "/" + file)) {
    throw new Error("missing RDS infrastructure artifact: " + root + "/" + file);
  }
}

const variables = fs.readFileSync(root + "/variables.tf", "utf8");
const main = fs.readFileSync(root + "/main.tf", "utf8");
const readme = fs.readFileSync(root + "/README.md", "utf8");
const haystack = variables + "\n" + main + "\n" + readme;

const requiredTokens = [
  ["backup retention default", /backup_retention_days[\s\S]*?default\s*=\s*14/],
  ["private RDS", /publicly_accessible\s*=\s*false/],
  ["Multi-AZ", /multi_az\s*=\s*true/],
  ["encryption", /storage_encrypted\s*=\s*true/],
  ["deletion protection", /deletion_protection\s*=\s*true/],
  ["managed master password", /manage_master_user_password\s*=\s*true/],
  ["IAM database authentication", /iam_database_authentication_enabled\s*=\s*true/],
  ["two-AZ subnet precondition", /at least two Availability Zones/],
  ["live state distinction", /live production instance was observed at 1 day/]
];

for (const [label, pattern] of requiredTokens) {
  if (!pattern.test(haystack)) throw new Error("RDS infrastructure contract missing: " + label);
}

if (/password\s*=\s*["'][^"']+["']/.test(main)) {
  throw new Error("literal database password detected in RDS Terraform");
}

console.log(JSON.stringify({
  status: "PASS",
  module: root,
  targetBackupRetentionDays: 14,
  liveBackupRetentionDays: 1,
  liveMutation: "blocked-by-aws-free-tier-restriction"
}));
