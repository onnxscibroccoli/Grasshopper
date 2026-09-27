/**
 * Live production secrets cutover re-verification assessor.
 *
 * Fail-closed: COMPLETE only when docs explicitly record a fresh live host
 * re-verification against Secrets Manager injection. Historical PR #16 notes
 * alone must not close this gate. Synthetic fixtures under
 * test/fixtures/secrets-cutover/ may exercise COMPLETE; real ops docs must
 * stay OPEN until an authorized operator records dated live evidence.
 */

function gate(id, label, status, evidence, { critical = true } = {}) {
  return {
    id,
    kind: "gate",
    label,
    status,
    critical,
    evidence
  };
}

/**
 * @param {string|null|undefined} reconstructionStatus
 * @param {string|null|undefined} migrationDoc
 */
export function assessProductionSecretsCutover(reconstructionStatus, migrationDoc) {
  const statusText = reconstructionStatus || "";
  const migrationText = migrationDoc || "";
  const combined = `${statusText}\n${migrationText}`;

  const freshLiveReverify =
    /live host re-verif(?:y|ied|ication).{0,80}(HELIX_AGENT_TOKEN_SECRET_ID|Secrets Manager)/i.test(
      combined
    ) &&
    /dated live cutover re-verification complete/i.test(combined);

  if (freshLiveReverify) {
    return gate(
      "production_secrets_cutover",
      "Live production secrets cutover re-verification",
      "COMPLETE",
      "docs record dated live host re-verification of Secrets Manager injection"
    );
  }

  return gate(
    "production_secrets_cutover",
    "Live production secrets cutover re-verification",
    "OPEN",
    "repository contract may be COMPLETE, but live host Secrets Manager cutover is not re-verified by this static gate; PR #16 migration notes are historical evidence only — do not treat as fresh live acceptance"
  );
}

export { gate };
