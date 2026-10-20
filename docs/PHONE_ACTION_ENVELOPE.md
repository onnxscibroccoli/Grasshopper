# Phone action envelope and pre-execution policy

Canonical device driver: **`onnxscibroccoli/mobilemcp`** (APK v0.6.0, evidenced 2026-10-19 on SM-A146U). Upstream `@mobilenext/mobile-mcp` is not the driver.

Every proposed phone action is one JSON object, and nothing else is accepted:

| Field | Type | Rule |
|-------|------|------|
| `device_id` | string | 32 lowercase hex (mobilemcp device id) |
| `tool` | string | `get_command_access` or `run_phone_command`; anything else → Block |
| `argv` | string[] | ≤64 entries, no NUL |
| `mutating` | boolean | caller's declaration; not trusted outside the allowlist |
| `request_id` | string | 8–128 chars `[A-Za-z0-9._:-]`, used for the idempotent ledger |

Decision (`src/android/phone-action-envelope.mjs`, `decide()`):
- Invalid shape, unknown field, or unknown tool → **Block**
- `get_command_access` non-mutating → **Allow**
- `run_phone_command` matching an exact read-only shape below → **Allow**
- Anything mutating or off the allowlist → **Escalate** (Ian approval)

Status: validation and tests only. Not yet wired into broccoli-core or the mobilemcp hub; no device was touched.

## Pre-execution hook

`executePhoneAction(envelope, { dispatch })` in `src/android/phone-action-hook.mjs`
checks a copied envelope immediately before calling the trusted dispatcher.
Only Allow dispatches; Block and Escalate return without calling it. Escalation
is a refusal to execute pending human review, never an approval flag. The
validated envelope and argv are frozen before dispatch. A thrown transport
error returns `COMMAND_OUTCOME_UNKNOWN` with the request id and is never retried
by this hook. `RETURNED` means the dispatcher returned, not device success.
Missing dispatch fails closed. This internal boundary does not authenticate a
caller, enroll a device, create a remote endpoint, or replace the durable ledger.
The controller adapter must persist intent before send, reserve request ids
atomically, and fence every unknown outcome against replay.

Exact read-only shapes (caller-declared `mutating=false` required):

- `["id"]` or `["whoami"]` with no arguments.
- `["getprop"]` or `["getprop", PROPERTY]`, where PROPERTY contains only ASCII
  letters, digits, underscore, period, or hyphen and does not begin with hyphen.
- `["dumpsys", "battery"]` or `["dumpsys", "display"]` with no further arguments.
- `get_command_access` requires empty argv.

Other command shapes escalate; unknown tools and invalid envelopes block.
Dumpsys subcommands such as `battery set` and `battery reset` never dispatch.
Dispatch must preserve argv boundaries and must not interpolate arguments into
a shell string. No shell, arbitrary executable path, or environment override
is accepted by this allowlist.

Local checks (from the repository root):

```sh
node --test test/phone-action-envelope.test.mjs test/phone-action-hook.test.mjs
npm test
node scripts/verify-no-broccoli-degradation.mjs
```

This hook has local unit coverage only. Control-plane service wiring,
broccoli-core/mobilemcp transport integration, durable replay fencing, and the
dated live device probe remain pending. `live_device_acceptance` stays NOT_RUN.
