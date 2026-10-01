export function createHumanHandoff(boundary, {
  taskId = null,
  checkpoint = null,
} = {}) {
  if (!boundary || boundary.status !== "HUMAN_REQUIRED") {
    throw new TypeError("a HUMAN_REQUIRED boundary is required");
  }

  return Object.freeze({
    schema: "omnikali.human-handoff/v1",
    status: "HUMAN_REQUIRED",
    taskId,
    reason: boundary.reason,
    message: "User action is required. Automation is paused and will resume after the boundary is cleared.",
    checkpoint,
    resume: {
      mode: "ON_USER_COMPLETION",
      event: "human.boundary.cleared",
    },
  });
}
