import fs from "node:fs";

const required = [
  "OMNIKALI_AWS_REGION",
  "OMNIKALI_VPC_ID",
  "OMNIKALI_DATABASE_ENDPOINT",
  "OMNIKALI_DATABASE_NAME",
  "OMNIKALI_DATABASE_SECRET_ID",
  "OMNIKALI_GATEWAY_SERVICE",
  "OMNIKALI_WORKER_SERVICE",
  "OMNIKALI_READINESS_URL",
  "OMNIKALI_ACCEPTANCE_MODE",
];

const secretLike = /(password|secret|token|cookie|private|credential)/i;
const missing = [];
const unsafe = [];

for (const name of required) {
  const value = process.env[name];
  if (!value) missing.push(name);
  if (value && secretLike.test(name)) unsafe.push(name);
}

if (unsafe.length) {
  console.error("Unsafe production input names detected:", unsafe.join(", "));
  process.exit(2);
}

if (missing.length) {
  console.error("Production deployment inputs are incomplete.");
  console.error("Missing:", missing.join(", "));
  console.error("No infrastructure defaults are permitted.");
  process.exit(1);
}

console.log("Production deployment input contract: PASS");
console.log("Validated", required.length, "required non-secret references.");
