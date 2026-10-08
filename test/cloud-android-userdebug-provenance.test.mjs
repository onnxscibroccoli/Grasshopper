import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const verifier = path.join(root, "scripts/cloud-android/verify-arm64-userdebug-provenance.mjs");
const profile = path.join(root, "environments/cloud-android-arm64-userdebug-build.json");

function storedZip(entries) {
  const local = [];
  const central = [];
  let offset = 0;

  for (const [name, contents] of entries) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(contents);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    local.push(localHeader, nameBytes, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + data.length;
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}

function fixture({ variant = "userdebug", buildType = "userdebug", members } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "grasshopper-userdebug-"));
  const archiveName = "UTM-VM-lineage-23.2-test-virtio_arm64only-userdebug.zip";
  const archive = path.join(dir, archiveName);
  const archiveBytes = storedZip(members ?? [
    ["LineageOS_on_arm64.utm/Data/vda.qcow2", "system"],
    ["LineageOS_on_arm64.utm/Data/vdb.qcow2", "data"],
  ]);
  fs.writeFileSync(archive, archiveBytes);

  const buildProperties = path.join(dir, "build.prop");
  const propertiesBytes = Buffer.from(`ro.build.type=${buildType}\nro.product.cpu.abi=arm64-v8a\n`);
  fs.writeFileSync(buildProperties, propertiesBytes);

  const manifest = {
    schema: "grasshopper.android-artifact-provenance/v1",
    profile_id: "lineage-23.2-virtio-arm64only-userdebug",
    source: {
      repository: "https://github.com/jqssun/android-lineage-qemu.git",
      ref: "v2026.07.09",
      commit: "54fc5dc82fa05778be15c1200240be53f707a542",
      build_script_blob_sha1: "b5babcdbefa664b1ffc447bda4dcf53b17628cb6",
    },
    build: {
      target: "virtio_arm64only",
      variant,
      goals: ["vm-utm-zip", "otapackage"],
    },
    artifact: {
      file: archiveName,
      sha256: crypto.createHash("sha256").update(archiveBytes).digest("hex"),
      size_bytes: archiveBytes.length,
    },
    build_properties: {
      file: "build.prop",
      sha256: crypto.createHash("sha256").update(propertiesBytes).digest("hex"),
    },
  };
  const manifestPath = path.join(dir, "provenance.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { dir, manifest, manifestPath };
}

function run(manifestPath) {
  return spawnSync(process.execPath, [verifier, profile, manifestPath], {
    cwd: root,
    encoding: "utf8",
  });
}

test("accepts a digest-bound full ARM64 userdebug VM with userdebug build properties", (t) => {
  const value = fixture();
  t.after(() => fs.rmSync(value.dir, { recursive: true, force: true }));
  const result = run(value.manifestPath);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASS arm64_userdebug_provenance/);
});

test("rejects a user build presented as the automation profile", (t) => {
  const value = fixture({ variant: "user" });
  t.after(() => fs.rmSync(value.dir, { recursive: true, force: true }));
  const result = run(value.manifestPath);
  assert.equal(result.status, 75);
  assert.match(result.stderr, /build_variant/);
});

test("rejects an artifact whose bytes do not match its manifest", (t) => {
  const value = fixture();
  t.after(() => fs.rmSync(value.dir, { recursive: true, force: true }));
  const artifact = path.join(value.dir, value.manifest.artifact.file);
  const bytes = fs.readFileSync(artifact);
  bytes[0] ^= 0xff;
  fs.writeFileSync(artifact, bytes);
  const result = run(value.manifestPath);
  assert.equal(result.status, 75);
  assert.match(result.stderr, /artifact_sha256/);
});

test("rejects an archive without both persistent VM disks", (t) => {
  const value = fixture({ members: [["LineageOS_on_arm64.utm/Data/vda.qcow2", "system"]] });
  t.after(() => fs.rmSync(value.dir, { recursive: true, force: true }));
  const result = run(value.manifestPath);
  assert.equal(result.status, 75);
  assert.match(result.stderr, /archive_member:Data\/vdb\.qcow2/);
});

test("rejects build properties that do not prove userdebug", (t) => {
  const value = fixture({ buildType: "user" });
  t.after(() => fs.rmSync(value.dir, { recursive: true, force: true }));
  const result = run(value.manifestPath);
  assert.equal(result.status, 75);
  assert.match(result.stderr, /build_property:ro\.build\.type=userdebug/);
});

test("repository provenance template cannot be mistaken for completed evidence", () => {
  const template = path.join(root, "deploy/cloud-android/arm64-userdebug-provenance.template.json");
  const result = run(template);
  assert.equal(result.status, 75);
  assert.doesNotMatch(result.stdout, /PASS/);
});
