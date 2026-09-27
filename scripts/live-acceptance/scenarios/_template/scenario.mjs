/**
 * Template for a live-acceptance scenario module.
 *
 * Copy to scripts/live-acceptance/scenarios/<id>/scenario.mjs and implement.
 * dryRun() must never claim COMPLETE and must never mutate the evidence manifest.
 * liveRun(ctx) is optional and reserved for authorized dated evidence recording;
 * this scaffold does not call Helix or mutate production.
 *
 * @typedef {{ ok: boolean, evidence: string, details?: Record<string, unknown> }} ScenarioResult
 * @typedef {{
 *   evidence: string,
 *   runAt: string,
 *   operator: string,
 *   scenarioId: string
 * }} LiveRunContext
 */

export const id = "REPLACE_WITH_SCENARIO_ID";
export const label = "Replace with human-readable scenario label";

/**
 * Local dry-run / self-check. Never writes COMPLETE. Never talks to production.
 * @returns {ScenarioResult}
 */
export function dryRun() {
  return {
    ok: false,
    evidence: "template — not implemented; replace dryRun() in a real scenario module"
  };
}

/**
 * Optional authorized record path. Implement only when a dated, authorized run
 * can produce non-secret evidence. Must not invent dates or COMPLETE claims.
 * Returning { ok: false } keeps the manifest unchanged (fail-closed).
 *
 * @param {LiveRunContext} _ctx
 * @returns {Promise<ScenarioResult> | ScenarioResult}
 */
export async function liveRun(_ctx) {
  return {
    ok: false,
    evidence: "template — liveRun not implemented; refuse record without a real scenario module"
  };
}
