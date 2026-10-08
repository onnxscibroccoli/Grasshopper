#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const VALIDATION_EXIT = 75;

function validationFailure(message) {
  const error = new Error(message);
  error.validation = true;
  throw error;
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    validationFailure(`${label}:unreadable:${error.message}`);
  }
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) validationFailure(`${label}:expected=${expected}`);
}

function requireString(value, label, pattern) {
  if (typeof value !== "string" || !pattern.test(value)) validationFailure(`${label}:invalid`);
}

function resolveSibling(manifestPath, name, label) {
  requireString(name, label, /^[A-Za-z0-9._-]+$/);
  return path.join(path.dirname(manifestPath), name);
}

function digest(file, algorithm = "sha256") {
  const hash = crypto.createHash(algorithm);
  const fd = fs.openSync(file, "r");
  const buffer = Buffer.alloc(1024 * 1024);
  try {
    for (;;) {
      const bytes = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (!bytes) break;
      hash.update(buffer.subarray(0, bytes));
    }
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest("hex");
}

function zipMembers(file) {
  const stat = fs.statSync(file);
  const tailSize = Math.min(stat.size, 65_557);
  const fd = fs.openSync(file, "r");
  try {
    const tail = Buffer.alloc(tailSize);
    fs.readSync(fd, tail, 0, tailSize, stat.size - tailSize);
    let eocd = -1;
    for (let index = tail.length - 22; index >= 0; index -= 1) {
      if (tail.readUInt32LE(index) === 0x06054b50) {
        eocd = index;
        break;
      }
    }
    if (eocd < 0) validationFailure("archive_zip:eocd_missing");
    const entries = tail.readUInt16LE(eocd + 10);
    const centralSize = tail.readUInt32LE(eocd + 12);
    const centralOffset = tail.readUInt32LE(eocd + 16);
    if (entries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
      validationFailure("archive_zip:zip64_unsupported");
    }
    if (centralSize > 16 * 1024 * 1024 || centralOffset + centralSize > stat.size) {
      validationFailure("archive_zip:central_directory_invalid");
    }
    const central = Buffer.alloc(centralSize);
    fs.readSync(fd, central, 0, centralSize, centralOffset);
    const names = [];
    let cursor = 0;
    for (let index = 0; index < entries; index += 1) {
      if (cursor + 46 > central.length || central.readUInt32LE(cursor) !== 0x02014b50) {
        validationFailure("archive_zip:central_entry_invalid");
      }
      const nameLength = central.readUInt16LE(cursor + 28);
      const extraLength = central.readUInt16LE(cursor + 30);
      const commentLength = central.readUInt16LE(cursor + 32);
      const end = cursor + 46 + nameLength;
      if (end > central.length) validationFailure("archive_zip:name_invalid");
      names.push(central.subarray(cursor + 46, end).toString("utf8"));
      cursor = end + extraLength + commentLength;
    }
    return names;
  } finally {
    fs.closeSync(fd);
  }
}

function properties(file) {
  const values = new Map();
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const separator = line.indexOf("=");
    values.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }
  return values;
}

export function verify(profilePath, manifestPath) {
  const profile = readJson(profilePath, "profile");
  const manifest = readJson(manifestPath, "manifest");
  requireEqual(profile.schema, "grasshopper.android-build-profile/v1", "profile_schema");
  requireEqual(profile.status, "build-profile-only", "profile_status");
  requireEqual(manifest.schema, profile.provenance.schema, "manifest_schema");
  requireEqual(manifest.profile_id, profile.id, "profile_id");
  requireEqual(manifest.source?.repository, profile.source.repository, "source_repository");
  requireEqual(manifest.source?.ref, profile.source.ref, "source_ref");
  requireEqual(manifest.source?.commit, profile.source.commit, "source_commit");
  requireEqual(manifest.source?.build_script_blob_sha1, profile.source.build_script_blob_sha1, "build_script_blob_sha1");
  requireEqual(manifest.build?.target, profile.build.target, "build_target");
  requireEqual(manifest.build?.variant, profile.build.variant, "build_variant");
  if (JSON.stringify(manifest.build?.goals) !== JSON.stringify(profile.build.goals)) {
    validationFailure("build_goals:invalid");
  }

  const artifactName = manifest.artifact?.file;
  requireString(artifactName, "artifact_file", new RegExp(profile.artifact.filename_regex));
  requireString(manifest.artifact?.sha256, "artifact_sha256", /^[a-f0-9]{64}$/);
  const artifact = resolveSibling(manifestPath, artifactName, "artifact_file");
  const artifactStat = fs.statSync(artifact);
  requireEqual(artifactStat.isFile(), true, "artifact_regular_file");
  requireEqual(artifactStat.size, manifest.artifact.size_bytes, "artifact_size_bytes");
  requireEqual(digest(artifact), manifest.artifact.sha256, "artifact_sha256");
  const members = zipMembers(artifact);
  for (const suffix of profile.artifact.required_member_suffixes) {
    if (!members.some((name) => name.endsWith(suffix))) validationFailure(`archive_member:${suffix}`);
  }

  const propertyName = manifest.build_properties?.file;
  const propertyFile = resolveSibling(manifestPath, propertyName, "build_properties_file");
  requireString(manifest.build_properties?.sha256, "build_properties_sha256", /^[a-f0-9]{64}$/);
  requireEqual(digest(propertyFile), manifest.build_properties.sha256, "build_properties_sha256");
  const buildProperties = properties(propertyFile);
  for (const [name, expected] of Object.entries(profile.artifact.required_build_properties)) {
    if (buildProperties.get(name) !== expected) validationFailure(`build_property:${name}=${expected}`);
  }

  return {
    profile_id: profile.id,
    source_commit: profile.source.commit,
    artifact_sha256: manifest.artifact.sha256,
    build_variant: manifest.build.variant,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  if (process.argv.length !== 4) {
    console.error(`Usage: ${process.argv[1]} PROFILE.json PROVENANCE.json`);
    process.exit(64);
  }
  try {
    const result = verify(path.resolve(process.argv[2]), path.resolve(process.argv[3]));
    console.log(`PASS arm64_userdebug_provenance profile=${result.profile_id} variant=${result.build_variant} artifact_sha256=${result.artifact_sha256}`);
  } catch (error) {
    console.error(`FAIL arm64_userdebug_provenance ${error.message}`);
    process.exit(error.validation ? VALIDATION_EXIT : 2);
  }
}
