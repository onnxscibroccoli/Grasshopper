import test from "node:test";
import assert from "node:assert/strict";
import { decide, validateEnvelope, CANONICAL_DEVICE_DRIVER } from "../src/android/phone-action-envelope.mjs";

const base = { device_id: "c1f33361d8d5412ba44cb8653f33025b", tool: "run_phone_command", argv: ["id"], mutating: false, request_id: "req-00000001" };

test("canonical driver is the mobilemcp fork", () => assert.equal(CANONICAL_DEVICE_DRIVER, "onnxscibroccoli/mobilemcp"));
test("read-only id is allowed", () => assert.equal(decide(base).decision, "Allow"));
test("status read is allowed", () => assert.equal(decide({ ...base, tool: "get_command_access", argv: [] }).decision, "Allow"));
test("mutating command escalates", () => assert.equal(decide({ ...base, argv: ["pm", "uninstall", "x"], mutating: true }).decision, "Escalate"));
test("unlisted command escalates even if declared non-mutating", () => assert.equal(decide({ ...base, argv: ["rm", "-rf", "/sdcard"] }).decision, "Escalate"));
test("shell metacharacters on allowlisted command escalate", () => assert.equal(decide({ ...base, argv: ["getprop", "x;reboot"] }).decision, "Escalate"));
test("unknown tool blocks", () => assert.equal(decide({ ...base, tool: "install_apk" }).decision, "Block"));
test("missing request_id blocks", () => assert.equal(decide({ ...base, request_id: undefined }).decision, "Block"));
test("bad device_id blocks", () => assert.equal(decide({ ...base, device_id: "SM-A146U" }).decision, "Block"));
test("extra field blocks", () => assert.equal(decide({ ...base, token: "x" }).decision, "Block"));
test("non-boolean mutating blocks", () => assert.equal(decide({ ...base, mutating: "no" }).decision, "Block"));
test("NUL in argv blocks", () => assert.equal(decide({ ...base, argv: ["id\u0000"] }).decision, "Block"));
test("empty argv blocks", () => assert.equal(decide({ ...base, argv: [] }).decision, "Block"));
test("non-object blocks", () => assert.deepEqual(validateEnvelope(null), ["envelope must be an object"]));
test("mutating status read blocks", () => assert.equal(decide({ ...base, tool: "get_command_access", argv: [], mutating: true }).decision, "Block"));
