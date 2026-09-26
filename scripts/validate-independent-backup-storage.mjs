import fs from "node:fs";

const root = "infra/aws/independent-backup-storage";
const required = ["providers.tf", "variables.tf", "main.tf", "outputs.tf", "README.md"];

for (const file of required) {
  if (!fs.existsSync(root + "/" + file)) {
    throw new Error("missing independent backup storage artifact: " + root + "/" + file);
  }
}

const variables = fs.readFileSync(root + "/variables.tf", "utf8");
const main = fs.readFileSync(root + "/main.tf", "utf8");
const readme = fs.readFileSync(root + "/README.md", "utf8");
const haystack = variables + "\n" + main + "\n" + readme;

const requiredTokens = [
  ["explicit bucket input", /variable\s+"bucket_name"/],
  ["customer-managed KMS input", /variable\s+"kms_key_arn"/],
  ["minimum fourteen-day lifecycle", /expiration_days\s*>=\s*14/],
  ["versioning", /aws_s3_bucket_versioning/],
  ["public access blocked", /block_public_policy\s*=\s*true/],
  ["TLS-only bucket policy", /aws:SecureTransport/],
  ["KMS server-side encryption", /sse_algorithm\s*=\s*"aws:kms"/],
  ["multipart cleanup", /abort_incomplete_multipart_upload/],
  ["production activation gate", /does not provision or activate production storage/]
];

for (const [label, pattern] of requiredTokens) {
  if (!pattern.test(haystack)) throw new Error("independent backup storage contract missing: " + label);
}

if (/password\s*=\s*["'][^"']+["']/.test(main)) {
  throw new Error("literal credential detected in backup storage Terraform");
}

console.log(JSON.stringify({
  status: "PASS",
  module: root,
  minimumRetentionDays: 14,
  defaultRetentionDays: 30,
  productionActivation: "not-applied"
}));
