import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAndroidAdmission } from "../lib/cloud-android/admission.mjs";

const mb = (n) => n * 1024 * 1024;

test("healthy host admits primary cloud Android launch", () => {
  const r = evaluateAndroidAdmission({
    memTotalBytes: mb(10240), memAvailableBytes: mb(6800),
    swapTotalBytes: mb(4096), swapFreeBytes: mb(3000),
    existingQemuRssBytes: 0, existingQemuCount: 0, requestedMb: 1024
  });
  assert.equal(r.decision, "PASS");
  assert.deepEqual(r.reasons, []);
});

test("low available memory fails closed", () => {
  const r = evaluateAndroidAdmission({
    memTotalBytes: mb(4096), memAvailableBytes: mb(700),
    swapTotalBytes: mb(2048), swapFreeBytes: mb(900),
    existingQemuRssBytes: mb(1800), existingQemuCount: 1, requestedMb: 1024
  });
  assert.equal(r.decision, "REJECT");
  assert.ok(r.reasons.includes("insufficient_mem_available"));
  assert.ok(r.reasons.includes("qemu_memory_envelope_exceeded"));
});

test("swap pressure is recorded as an independent rejection reason", () => {
  const r = evaluateAndroidAdmission({
    memTotalBytes: mb(16384), memAvailableBytes: mb(10000),
    swapTotalBytes: mb(2048), swapFreeBytes: mb(128),
    existingQemuRssBytes: 0, existingQemuCount: 0, requestedMb: 1024
  });
  assert.equal(r.decision, "REJECT");
  assert.ok(r.reasons.includes("insufficient_swap_free"));
});
