// Phone action envelope: the single message shape every proposed phone action
// must take before Grasshopper evaluates it. Validation only; this module never
// talks to a device. Decision is Allow | Block | Escalate, fail-closed.

export const CANONICAL_DEVICE_DRIVER = "onnxscibroccoli/mobilemcp";

// Read-only argv[0] values allowed without escalation (first slice of MVP).
export const READ_ONLY_COMMANDS = Object.freeze(["id", "getprop", "whoami", "dumpsys"]);

const KNOWN_TOOLS = Object.freeze(["get_command_access", "run_phone_command"]);
const DEVICE_ID = /^[0-9a-f]{32}$/;
const REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

export function validateEnvelope(env) {
  const errors = [];
  if (!env || typeof env !== "object" || Array.isArray(env)) return ["envelope must be an object"];
  const allowed = new Set(["device_id", "tool", "argv", "mutating", "request_id"]);
  for (const k of Object.keys(env)) if (!allowed.has(k)) errors.push(`unknown field: ${k}`);
  if (typeof env.device_id !== "string" || !DEVICE_ID.test(env.device_id)) errors.push("device_id must be 32 lowercase hex");
  if (typeof env.tool !== "string" || env.tool.length === 0) errors.push("tool required");
  if (!Array.isArray(env.argv) || env.argv.length > 64 ||
      Array.from(env.argv).some((a) => typeof a !== "string" || a.length > 4096 || a.includes("\u0000"))) errors.push("argv must be ≤64 strings without NUL");
  if (typeof env.mutating !== "boolean") errors.push("mutating must be boolean");
  if (typeof env.request_id !== "string" || !REQUEST_ID.test(env.request_id)) errors.push("request_id invalid");
  return errors;
}

export function decide(env) {
  const errors = validateEnvelope(env);
  if (errors.length) return { decision: "Block", reason: errors.join("; ") };
  if (!KNOWN_TOOLS.includes(env.tool)) return { decision: "Block", reason: `unknown tool: ${env.tool}` };
  if (env.tool === "get_command_access") {
    if (env.argv.length !== 0) return { decision: "Block", reason: "status tool takes no argv" };
    return env.mutating ? { decision: "Block", reason: "get_command_access is read-only" } : { decision: "Allow", reason: "read-only status" };
  }
  // run_phone_command
  if (env.argv.length === 0) return { decision: "Block", reason: "empty argv" };
  if (env.mutating) return { decision: "Escalate", reason: "mutating command needs Ian approval" };
  const [command, ...args] = env.argv;
  const readOnly =
    ((command === "id" || command === "whoami") && args.length === 0) ||
    (command === "getprop" && (args.length === 0 ||
      (args.length === 1 && /^[A-Za-z0-9_.-]+$/.test(args[0]) && !args[0].startsWith("-")))) ||
    (command === "dumpsys" && args.length === 1 && ["battery", "display"].includes(args[0]));
  if (readOnly) {
    return { decision: "Allow", reason: `read-only allowlist: ${env.argv[0]}` };
  }
  // Caller-declared non-mutating is not trusted outside the allowlist.
  return { decision: "Escalate", reason: `command not on read-only allowlist: ${env.argv[0]}` };
}
