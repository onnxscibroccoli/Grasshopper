/**
 * Live-acceptance scenario: duplicate_fencing
 *
 * Duplicate/stale owner identity is fenced from completing.
 * dryRun validates in-memory fixtures mirroring Helix task-state owner fencing
 * (accepted pin 38903b021cca75189a99e1ed88b508bae577f048). It never writes
 * COMPLETE to the evidence manifest and never talks to Helix/production.
 *
 * liveRun refuses record until an authorized dated live/isolated run exists
 * (fail-closed). Do not invent dates or COMPLETE claims.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runFixture } from "./owner-fence-sim.mjs";

export const id = "duplicate_fencing";
export const label = "Duplicate/stale owner identity is fenced from completing";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(HERE, "fixtures");

const REQUIRED_FIXTURES = [
  "current-owner-completes.json",
  "stale-owner-fenced.json",
  "duplicate-claim-while-leased.json",
  "stale-owner-fail-fenced.json"
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
      evidence: `duplicate_fencing dry-run failed: ${err?.message || String(err)}`,
      details: {
        passed,
        fixtures_dir: "scripts/live-acceptance/scenarios/duplicate_fencing/fixtures"
      }
    };
  }

  return {
    ok: true,
    evidence:
      "duplicate_fencing dry-run: owner-fence fixtures passed " +
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
      "duplicate_fencing liveRun refused: no authorized dated live/isolated run wired yet (fail-closed; manifest unchanged)",
    details: {
      reason: "record_path_not_authorized",
      production_mutated: false
    }
  };
}
