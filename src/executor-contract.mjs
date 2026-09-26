export const COMMAND_DISPOSITIONS = Object.freeze({
  READ_ONLY: "read_only",
  IDEMPOTENT_MUTATION: "idempotent_mutation",
  NON_IDEMPOTENT_MUTATION: "non_idempotent_mutation",
  INTERACTIVE: "interactive"
});

export const COMPLETION_STATES = Object.freeze({
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  INDETERMINATE: "indeterminate"
});

export function commandDisposition(task) {
  const value = task?.commandDisposition;
  if (!Object.values(COMMAND_DISPOSITIONS).includes(value)) {
    throw new Error("commandDisposition is required");
  }
  return value;
}

export function assertCompletion(result, disposition) {
  if (!result || !Object.values(COMPLETION_STATES).includes(result.completion)) {
    throw new Error("executor completion state is required");
  }

  if (
    result.completion === COMPLETION_STATES.INDETERMINATE &&
    disposition === COMMAND_DISPOSITIONS.READ_ONLY &&
    !result.reconciliation
  ) {
    throw new Error("read-only execution cannot report indeterminate without reconciliation metadata");
  }

  if (
    result.completion === COMPLETION_STATES.CONFIRMED &&
    result.canceled
  ) {
    throw new Error("cancelled execution cannot report confirmed completion");
  }

  return result;
}
