// Pure classification: callers supply observations, never credentials.
export function detectContext(facts = {}) {
  const android = Number.isInteger(facts.androidSdk) && facts.androidSdk > 0;
  const termux = facts.termux === true;
  const emulator = facts.qemu === true;
  if (facts.oci === true && (android || termux)) return 'unknown';
  if (android && emulator) return 'cloud-android';
  // Absence of emulator evidence is not proof of a physical device.
  if (android && termux && facts.qemu === false && facts.hardware === 'physical') return 'physical-android';
  if (facts.oci === true && facts.platform === 'linux') return 'oci-workstation';
  return 'unknown';
}

export function validateProfile(profile, context) {
  if (profile?.schema !== 'grasshopper.environment/v1' || profile.context !== context) {
    throw new Error('Environment profile identity/schema mismatch');
  }
  if (!Array.isArray(profile.controlDirections) || profile.executeAutomatically !== false) {
    throw new Error('Profiles describe capabilities; they cannot authorize execution');
  }
  return profile;
}
