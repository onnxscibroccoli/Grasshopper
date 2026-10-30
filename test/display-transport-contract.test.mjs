import test from "node:test";
import assert from "node:assert/strict";
import { assertLiveFrameEvidence, assertDisplayTransport, transportResult } from "../src/display/transport-contract.mjs";
import { createDisplayTransportRegistry } from "../src/display/transport-registry.mjs";

function fake(name = "scrcpy") {
  return {
    name,
    async start() { return transportResult(this, "start", { state: "ready" }); },
    async stop() { return transportResult(this, "stop", { state: "stopped" }); },
    async inspect() { return transportResult(this, "inspect", { state: "ready" }); }
  };
}

test("display transport contract is provider-neutral and fail-closed", () => {
  const transport = fake();
  assertDisplayTransport(transport);
  assert.equal(transportResult(transport, "inspect", { state: "ready" }).transport, "scrcpy");
  assert.throws(() => assertDisplayTransport({ name: "scrcpy" }), /missing start/);
  assert.throws(() => assertDisplayTransport({ ...fake("unknown") }), /unsupported display transport/);
});

test("transport registry resolves only registered providers", () => {
  const registry = createDisplayTransportRegistry({ scrcpy: fake(), cuttlefish: fake("cuttlefish-webrtc") });
  assert.deepEqual(registry.capabilities(), ["cuttlefish-webrtc", "scrcpy"]);
  assert.equal(registry.get("scrcpy").name, "scrcpy");
  assert.throws(() => registry.get("websocket"), /not registered/);
});

test("live frame evidence cannot be inferred from a ready control record", () => {
  assert.throws(() => assertLiveFrameEvidence({ ok: true, state: "ready" }), /live frame transport is not proven|requires PASS evidence/);
  assert.throws(() => assertLiveFrameEvidence({
    ok: true, state: "ready", evidence: { status: "PASS", bidirectional: true, framesObserved: false }
  }), /observed frames/);
  const pass = assertLiveFrameEvidence({
    ok: true,
    state: "ready",
    evidence: { status: "PASS", bidirectional: true, framesObserved: true }
  });
  assert.equal(pass.state, "ready");
});
