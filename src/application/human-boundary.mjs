export const HUMAN_BOUNDARIES = Object.freeze([
  "AUTHENTICATION_REQUIRED",
  "OAUTH_AUTHORIZATION_REQUIRED",
  "MFA_REQUIRED",
  "CAPTCHA_REQUIRED",
  "BOT_CHECK_REQUIRED",
  "SECURITY_KEY_REQUIRED",
  "BIOMETRIC_REQUIRED",
  "CONSENT_REQUIRED",
  "PAYMENT_AUTHORIZATION_REQUIRED",
]);

const RULES = Object.freeze([
  ["CAPTCHA_REQUIRED", /\b(captcha|recaptcha|hcaptcha|turnstile)\b/i],
  ["BOT_CHECK_REQUIRED", /\b(verify you are human|checking your browser|bot check|automated traffic)\b/i],
  ["MFA_REQUIRED", /\b(one[- ]time (code|password)|otp|authenticator app|verification code)\b/i],
  ["SECURITY_KEY_REQUIRED", /\b(security key|passkey|hardware key|yubikey)\b/i],
  ["BIOMETRIC_REQUIRED", /\b(fingerprint|face id|touch id|biometric)\b/i],
  ["PAYMENT_AUTHORIZATION_REQUIRED", /\b(3[- ]d secure|payment authentication|authorize payment)\b/i],
  ["OAUTH_AUTHORIZATION_REQUIRED", /\b(oauth|device authorization|authorize (?:this )?(?:app|application|device)|grant access|allow .{0,40} access)\b/i],
  ["AUTHENTICATION_REQUIRED", /\b(sign in|log in|login|required authentication|authentication required)\b/i],
  ["CONSENT_REQUIRED", /\b(cookie consent|accept cookies|terms and conditions|privacy consent)\b/i],
]);

export function detectHumanBoundary(observation = {}) {
  const text = [
    observation.url,
    observation.title,
    observation.text,
    observation.accessibilityText,
  ].filter(Boolean).join("\n");

  for (const [reason, pattern] of RULES) {
    if (pattern.test(text)) {
      return Object.freeze({
        schema: "omnikali.human-boundary/v1",
        status: "HUMAN_REQUIRED",
        reason,
        automation: "PAUSED",
        resume: "ON_USER_COMPLETION",
      });
    }
  }

  return null;
}
