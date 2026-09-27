#!/usr/bin/env node
// Read-only systemd inventory. Never requests Environment, ExecStart, or process command lines.
import { execFileSync } from "node:child_process";

const units = ["helix-gateway.service", "omni-agent.service", "omni-mcp.service"];
const keys = ["Id", "LoadState", "ActiveState", "SubState", "User", "FragmentPath", "WorkingDirectory", "EnvironmentFiles", "Requires", "After", "Restart"];
const properties = ["Id", "LoadState", "ActiveState", "SubState", "User", "FragmentPath", "WorkingDirectory", "EnvironmentFiles", "Requires", "After", "Restart"];

function readUnit(unit) {
  const output = execFileSync("systemctl", ["show", unit, ...properties.flatMap((property) => ["-p", property]), "--no-pager"], { encoding: "utf8", timeout: 5000, maxBuffer: 65536 });
  const fields = Object.fromEntries(output.split("\n").filter(Boolean).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index), line.slice(index + 1)];
  }));
  const selected = Object.fromEntries(keys.map((key) => [key, fields[key] ?? ""]));
  if (selected.EnvironmentFiles.includes("\n") || /(?:password|token|secret)\s*=/i.test(selected.EnvironmentFiles)) {
    throw new Error(`unsafe EnvironmentFiles property for ${unit}`);
  }
  return selected;
}

try {
  const report = { schemaVersion: 1, source: "systemctl show", observedAt: new Date().toISOString(), units: units.map(readUnit) };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`service inventory failed: ${error.message.split("\n")[0]}\n`);
  process.exitCode = 1;
}
