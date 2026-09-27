/**
 * Acceptance scenario: replacement_completion (live record path disabled)
 *
 * Owner-fenced replacement completion after reclaim.
 * dryRun validates in-memory fixtures mirroring Helix task-state owner fencing
 * (accepted pin 38903b021cca75189a99e1ed88b508bae577f048). It never writes
 * COMPLETE to the evidence manifest and never talks to Helix/production.
 *
 * liveRun is intentionally disabled until an authorized dated live/isolated run exists
 * (fail-closed). Do not invent dates or COMPLETE claims.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runFixture } from "./owner-fence-sim.mjs";

export const id = "replacement_completion";
export const label = "Owner-fenced replacement completion after reclaim";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(HERE, "fixtures");

const REQUIRED_FIXTURES = [
  "happy-path.json",
  "stale-owner-fenced.json"
];

function loadFixture(name) {
  const full = path.join(FIXTURES_DIR, name);
  if (!fs.existsSync(full)) {
    throw new Error(`missing fixture: fixtures/${name}`);
  }
  return JSON.parse(fs.readFileSync(full, "utf8"));
}

/**
 * Local fixture self-check. ok=true means fixtures pass; does NOT mean live COMPLETE.
 * @returns {{ ok: boolean, evidence: string, details?: Record<string, unknown> }}
 */
export function dryRun() {
  const passed = [];
  try {
    for (const name of REQUIRED_FIXTURES) {
      const fixture = loadFixture(name);
      runFixture(fixture);
      passed.push(fixture.id || name);
    }
  } catch (err) {
    return {
      ok: false,
      evidence: `replacement_completion dry-run failed: ${err?.message || String(err)}`,
      details: { passed, fixtures_dir: "scripts/live-acceptance/scenarios/replacement_completion/fixtures" }
    };
  }

  return {
    ok: true,
    evidence:
      "replacement_completion dry-run: owner-fence fixtures passed " +
      `(${passed.join(", ")}); local sim only — not live COMPLETE evidence`,
    details: {
      fixtures_passed: passed,
      helix_pin: "38903b021cca75189a99e1ed88b508bae577f048",
      production_mutated: false,
      manifest_complete_claimed: false
    }
  };
}

/**
 * Authorized record path. Refuses until a real dated authorized run is wired.
 * Returning not_ok keeps the manifest unchanged (fail-closed).
 *
 * @param {{ evidence: string, runAt: string, operator: string, scenarioId: string }} _ctx
 * @returns {Promise<{ ok: boolean, evidence: string, details?: Record<string, unknown> }>}
 */
export async function liveRun(_ctx) {
  return {
    ok: false,
    evidence:
      "replacement_completion liveRun refused: no authorized dated live/isolated run wired yet (fail-closed; manifest unchanged)",
    details: {
      reason: "record_path_not_authorized",
      production_mutated: false
    }
  };
}
