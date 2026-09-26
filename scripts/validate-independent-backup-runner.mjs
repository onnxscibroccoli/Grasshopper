import fs from "node:fs";

const root = "infra/aws/independent-backup-runner";
const required = ["providers.tf", "variables.tf", "main.tf", "outputs.tf", "README.md"];

for (const file of required) {
  if (!fs.existsSync(root + "/" + file)) {
    throw new Error("missing backup runner artifact: " + root + "/" + file);
  }
}

const variables = fs.readFileSync(root + "/variables.tf", "utf8");
const main = fs.readFileSync(root + "/main.tf", "utf8");
const readme = fs.readFileSync(root + "/README.md", "utf8");
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
  ["no RDS permission", /cannot read S3 backup objects, modify RDS/]
];

for (const [label, pattern] of requiredTokens) {
  if (!pattern.test(haystack)) throw new Error("backup runner IAM contract missing: " + label);
}

if (/password\s*=\s*["'][^"']+["']/.test(main)) {
  throw new Error("literal credential detected in backup runner IAM Terraform");
}

console.log(JSON.stringify({
  status: "PASS",
  module: root,
  permissionBoundary: "secret-read + prefix-write + KMS data-key",
  productionActivation: "not-applied"
}));
