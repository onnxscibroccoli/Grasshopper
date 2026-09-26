#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { validateManifest } from "../lib/independent-backup-policy.mjs";

const command = process.argv[2] ?? "help";
const env = process.env;
function die(message) { console.error(`ERROR: ${message}`); process.exit(2); }
function requireEnv(name) { if (!env[name]) die(`missing required environment variable ${name}`); return env[name]; }

async function run(program, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { stdio: options.stdio ?? "inherit", env: { ...env, ...(options.env ?? {}) } });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`${program} exited ${code}`)));
  });
}

async function secret() {
  const secretId = requireEnv("BACKUP_DB_SECRET_ID");
  const out = [];
  await new Promise((resolve, reject) => {
    const child = spawn("aws", ["secretsmanager","get-secret-value","--secret-id",secretId,"--query","SecretString","--output","text"], {env, stdio:["ignore","pipe","inherit"]});
    child.on("error", reject);
    child.stdout.on("data", c => out.push(c));
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`aws secretsmanager exited ${code}`)));
  });
  const value = JSON.parse(Buffer.concat(out).toString());
  if (!value || typeof value !== "object") throw new Error("secret must be a JSON object");
  return value;
}

async function create() {
  const outDir = requireEnv("BACKUP_OUTPUT_DIR");
  const sourceInstance = requireEnv("BACKUP_SOURCE_INSTANCE");
  const migrationRevision = requireEnv("BACKUP_MIGRATION_REVISION");
  const encryptionKeyId = requireEnv("BACKUP_ENCRYPTION_KEY_ID");
  const destination = requireEnv("BACKUP_S3_URI");
  await mkdir(outDir, { recursive: true, mode: 0o700 });

  const s = await secret();
  for (const key of ["host", "username", "password"]) {
    if (!s[key]) die(`database secret missing ${key}`);
  }

  const workDir = join(tmpdir(), `omnikali-backup-${process.pid}-${Date.now()}`);
  await mkdir(workDir, { recursive: true, mode: 0o700 });
  const passFile = join(workDir, "pgpass");
  await writeFile(passFile, `${s.host}:${s.port ?? 5432}:${s.dbname ?? "*"}:${s.username}:${s.password}\n`, { mode: 0o600 });

  const raw = join(workDir, "database.dump");
  const compressed = join(workDir, "database.dump.zst");
  const encrypted = join(outDir, `${sourceInstance}-${new Date().toISOString().replace(/[:.]/g, "-")}.dump.zst.age`);

  try {
    await run("pg_dump", ["--format=custom","--no-owner","--no-acl","--sslmode=require","--host",s.host,"--port",String(s.port ?? 5432),"--username",s.username,"--dbname",s.dbname ?? "postgres","--file",raw], {env:{PGPASSFILE:passFile}});
    await run("zstd", ["--ultra","-19","--rm",raw,"-o",compressed]);
    await run("age", ["-R", requireEnv("BACKUP_RECIPIENT_FILE"), "-o", encrypted, compressed]);

    const hash = createHash("sha256").update(await readFile(encrypted)).digest("hex");
    const size = (await stat(encrypted)).size;
    const manifest = {
      backup_id: basename(encrypted),
      created_at: new Date().toISOString(),
      source_instance: sourceInstance,
      postgres_version: String(s.server_version ?? "unknown"),
      migration_revision: migrationRevision,
      artifact_sha256: hash,
      artifact_size: size,
      compression: "zstd",
      encryption_key_id: encryptionKeyId,
      restore_test_status: "not-tested"
    };
    validateManifest(manifest);
    const manifestPath = encrypted + ".json";
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 });

    await run("aws", ["s3","cp",encrypted,destination]);
    await run("aws", ["s3","cp",manifestPath,destination]);
    console.log(JSON.stringify({status:"PASS",backup_id:manifest.backup_id,artifact_sha256:hash,artifact_size:size}));
  } finally {
    await rm(workDir, {recursive:true,force:true}).catch(()=>{});
  }
}
if (command === "create") await create();
else die("usage: independent-postgres-backup.mjs create");
