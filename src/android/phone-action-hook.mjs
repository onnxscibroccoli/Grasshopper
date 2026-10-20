import { decide } from './phone-action-envelope.mjs';

// Internal pre-execution boundary, not a network endpoint or transferable grant.
// dispatch is trusted wiring supplied by the controller, never by model input.
export async function executePhoneAction(input, { dispatch } = {}) {
  let envelope;
  try {
    envelope = structuredClone(input);
  } catch {
    return { decision: 'Block', reason: 'envelope is not cloneable', dispatched: false };
  }
  const verdict = decide(envelope);
  const record = { ...verdict, request_id: envelope?.request_id, dispatched: false };
  if (verdict.decision !== 'Allow') return record;
  if (typeof dispatch !== 'function') {
    return { ...record, decision: 'Block', reason: 'trusted dispatch unavailable' };
  }
  Object.freeze(envelope.argv);
  Object.freeze(envelope);
  try {
    const result = await dispatch(envelope);
    return { ...record, dispatched: true, outcome: 'RETURNED', result };
  } catch {
    // Do not leak transport errors or repeat an operation after an uncertain send.
    return { ...record, dispatched: true, outcome: 'COMMAND_OUTCOME_UNKNOWN' };
  }
}
