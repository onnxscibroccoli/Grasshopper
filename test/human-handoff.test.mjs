import test from "node:test";
import assert from "node:assert/strict";
import { detectHumanBoundary } from "../src/application/human-boundary.mjs";
import { createHumanHandoff } from "../src/application/human-handoff.mjs";

test("human handoff preserves checkpoint and explicit resume event", () => {
  const boundary = detectHumanBoundary({ text: "Enter your one-time code" });
  const handoff = createHumanHandoff(boundary, {
    taskId: "task-1",
    checkpoint: { url: "https://example.test", step: 3 },
  });

  assert.equal(handoff.schema, "omnikali.human-handoff/v1");
  assert.equal(handoff.status, "HUMAN_REQUIRED");
  assert.equal(handoff.reason, "MFA_REQUIRED");
  assert.equal(handoff.checkpoint.step, 3);
  assert.equal(handoff.resume.event, "human.boundary.cleared");
});
