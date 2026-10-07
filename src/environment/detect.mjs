import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ENV_DIR = path.join(ROOT, "environments");

function prop(name) {
  try {
    return execFileSync("getprop", [name], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function markerCandidates(env) {
  return [
    env.GRASSHOPPER_ENV_FILE,
    path.join(process.cwd(), ".omnikali", "environment.json"),
    path.join(process.cwd(), ".grasshopper", "environment.json"),
    path.join(os.homedir(), ".config", "grasshopper", "environment.json")
  ].filter(Boolean);
}

function loadConfig(kind) {
  const file = path.join(ENV_DIR, kind + ".json");
  if (!fs.existsSync(file)) throw new Error("No environment configuration for " + kind);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function detectEnvironment(env = process.env) {
  for (const candidate of markerCandidates(env)) {
    if (!fs.existsSync(candidate)) continue;
    const value = JSON.parse(fs.readFileSync(candidate, "utf8"));
    const kind = value.kind || value.environment || value.name;
    if (kind && fs.existsSync(path.join(ENV_DIR, kind + ".json"))) {
      return { ...loadConfig(kind), source: "marker", marker: candidate };
    }
  }

  if (env.GRASSHOPPER_ENV) {
    return { ...loadConfig(env.GRASSHOPPER_ENV), source: "explicit" };
  }

  const termux = (env.PREFIX || "").includes("/com.termux/files/usr");
  const android = termux || !!prop("ro.build.version.sdk");
  if (android) {
    const hardware = prop("ro.hardware");
    const qemu = prop("ro.kernel.qemu") === "1" || hardware.includes("ranchu") || hardware.includes("goldfish");
    return { ...loadConfig(qemu ? "cloud-android" : "physical-android"), source: "runtime", signals: { termux, qemu } };
  }

  return {
    ...loadConfig("grasshopper-workstation"),
    source: "runtime",
    signals: { platform: process.platform, hostname: os.hostname() }
  };
}

export function loadActiveEnvironment() {
  return detectEnvironment();
}

if (process.argv[1] && import.meta.url === "file://" + process.argv[1]) {
  console.log(JSON.stringify(loadActiveEnvironment(), null, 2));
}
