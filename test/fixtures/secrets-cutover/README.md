# Secrets cutover dry-run doc fixtures

**SYNTHETIC ONLY.** These markdown fragments exercise
`assessProductionSecretsCutover` from `lib/assess-production-secrets-cutover.mjs`.

They do **not** authorize production mutation, credential rotation, or closing
the live `production_secrets_cutover` gate.

- A fixture that assesses **COMPLETE** proves the assessor *can* close when both
  required phrases are present.
- **Synthetic COMPLETE ≠ live production_secrets_cutover COMPLETE.**
- Never copy the completion sentence into real ops docs
  (`docs/PRODUCTION_RECONSTRUCTION_STATUS.md`,
  `docs/operations/AGENT_SECRET_MIGRATION.md`) until an authorized operator has
  finished host evidence and Ian has authorized recording it.

Run: `npm run verify:secrets-cutover-dryrun`
