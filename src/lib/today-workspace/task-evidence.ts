// An absent event is not an explicit zero confirmation. Confirmations only
// count while their fingerprint still describes the authoritative sources.
export function hasTaskEvidence(input: {
  hasActivity: boolean;
  sourceFingerprint: string;
  attestationFingerprint: string | null;
}): boolean {
  return input.hasActivity || Boolean(input.sourceFingerprint
    && input.attestationFingerprint === input.sourceFingerprint);
}
