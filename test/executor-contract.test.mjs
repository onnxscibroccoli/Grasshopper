import test from "node:test";
import assert from "node:assert/strict";
import {
  COMMAND_DISPOSITIONS,
  COMPLETION_STATES,
  commandDisposition,
  assertCompletion
} from "../src/executor-contract.mjs";

test("requires an explicit command disposition", () => {
  assert.throws(() => commandDisposition({ command: "rm -f file" }), /commandDisposition is required/);
  assert.equal(
    commandDisposition({ commandDisposition: COMMAND_DISPOSITIONS.NON_IDEMPOTENT_MUTATION }),
    COMMAND_DISPOSITIONS.NON_IDEMPOTENT_MUTATION
  );
});

test("accepts confirmed completion for an idempotent mutation", () => {
  const result = assertCompletion(
    { completion: COMPLETION_STATES.CONFIRMED, code: 0, canceled: false },
    COMMAND_DISPOSITIONS.IDEMPOTENT_MUTATION
  );
  assert.equal(result.completion, "confirmed");
});

test("rejects confirmed completion after cancellation", () => {
  assert.throws(
    () => assertCompletion(
      { completion: COMPLETION_STATES.CONFIRMED, code: 0, canceled: true },
      COMMAND_DISPOSITIONS.NON_IDEMPOTENT_MUTATION
    ),
    /cancelled execution cannot report confirmed completion/
  );
});

test("non-idempotent interruption remains indeterminate", () => {
  const result = assertCompletion(
    { completion: COMPLETION_STATES.INDETERMINATE, interrupted: true, code: null },
    COMMAND_DISPOSITIONS.NON_IDEMPOTENT_MUTATION
  );
  assert.equal(result.completion, "indeterminate");
});

test("interactive interruption remains indeterminate", () => {
  const result = assertCompletion(
    { completion: COMPLETION_STATES.INDETERMINATE, interrupted: true, code: null },
    COMMAND_DISPOSITIONS.INTERACTIVE
  );
  assert.equal(result.completion, "indeterminate");
});

test("rejects read-only indeterminate without reconciliation metadata", () => {
  assert.throws(
    () => assertCompletion(
      { completion: COMPLETION_STATES.INDETERMINATE, interrupted: true, code: null },
      COMMAND_DISPOSITIONS.READ_ONLY
    ),
    /read-only execution cannot report indeterminate without reconciliation metadata/
  );
});

test("accepts read-only indeterminate when reconciliation metadata is present", () => {
  const result = assertCompletion(
    {
      completion: COMPLETION_STATES.INDETERMINATE,
      interrupted: true,
      code: null,
      reconciliation: { source: "external_inspection", outcome: "absent" }
    },
    COMMAND_DISPOSITIONS.READ_ONLY
  );
  assert.equal(result.completion, "indeterminate");
  assert.equal(result.reconciliation.source, "external_inspection");
});
