/**
 * Canonical required live-acceptance scenario ids.
 * Must stay in sync with scripts/verify-live-acceptance.mjs REQUIRED_SCENARIOS.
 */
export const REQUIRED_SCENARIO_IDS = [
  "normal_exec",
  "worker_termination",
  "stale_lease_reclaim",
  "replacement_completion",
  "duplicate_fencing",
  "gateway_restart",
  "db_failure",
  "network_interrupt"
];

export const REQUIRED_SCENARIO_LABELS = {
  normal_exec:
    "Normal authenticated task execution through gateway to worker/Kali",
  worker_termination:
    "Worker termination preserves durable task state for reclaim",
  stale_lease_reclaim:
    "Expired lease returns task to PENDING and allows reclaim",
  replacement_completion:
    "Owner-fenced replacement completion after reclaim",
  duplicate_fencing:
    "Duplicate/stale owner identity is fenced from completing",
  gateway_restart:
    "Gateway restart preserves accepted work and resumes safely",
  db_failure:
    "Database failure/outage surfaces safely without false COMPLETE",
  network_interrupt:
    "Network interrupt between gateway/worker/DB does not corrupt task state"
};

export function isKnownScenarioId(id) {
  return REQUIRED_SCENARIO_IDS.includes(id);
}
