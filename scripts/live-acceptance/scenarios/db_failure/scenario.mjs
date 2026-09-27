/**
 * Live-acceptance scenario stub: db_failure
 *
 * Scaffold only — dryRun fails closed; liveRun refuses record.
 * Does not call Helix, mutate production, or write COMPLETE evidence.
 */

export const id = "db_failure";
export const label = "Database failure/outage surfaces safely without false COMPLETE";

/**
 * Local wiring check. Intentionally not_ok so scenarios stay OPEN.
 * @returns {{ ok: boolean, evidence: string }}
 */
export function dryRun() {
  return {
    ok: false,
    evidence: "scaffold stub — not implemented"
  };
}

/**
 * Authorized record path. Stub refuses so the runner cannot mark COMPLETE.
 * @param {{ evidence: string, runAt: string, operator: string, scenarioId: string }} _ctx
 * @returns {Promise<{ ok: boolean, evidence: string }>}
 */
export async function liveRun(_ctx) {
  return {
    ok: false,
    evidence: "scaffold stub — liveRun not implemented; refuse record (fail-closed)"
  };
}
