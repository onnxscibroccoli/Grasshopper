# Phone action envelope (contract stub)

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
- `run_phone_command` with `argv[0]` in `id`, `getprop`, `whoami` and no shell metacharacters → **Allow**
- Anything mutating or off the allowlist → **Escalate** (Ian approval)

Status: validation and tests only. Not yet wired into broccoli-core or the mobilemcp hub; no device was touched.
