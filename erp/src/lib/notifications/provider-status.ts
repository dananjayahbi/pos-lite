/**
 * Outbound-provider status (M31-01 / BUG-73).
 *
 * The communications module's silent-failure problem: when a provider's
 * credentials are absent (INF-03 owns supplying them), every send returns a
 * normal `{ success: false }` result and the API still answers 200. Nothing in
 * logs, Sentry or `/api/health` made the outage visible.
 *
 * This module is the single place that answers "which outbound providers are
 * configured?" plus the code constants callers must surface, so the three send
 * paths (email, WhatsApp, broadcast) don't each invent their own wording.
 */

/** Machine-readable rejection codes exposed to callers/UI. */
export const PROVIDER_NOT_CONFIGURED = 'PROVIDER_NOT_CONFIGURED';
export const PROVIDER_ERROR = 'PROVIDER_ERROR';

/** Codes for the WhatsApp-specific surface that historically leaked raw text. */
export const WHATSAPP_NOT_CONFIGURED = 'WHATSAPP_NOT_CONFIGURED';
export const WHATSAPP_FAILED = 'WHATSAPP_FAILED';

/** Codes for the SMS broadcast surface. */
export const SMS_NOT_CONFIGURED = 'SMS_NOT_CONFIGURED';
export const SMS_FAILED = 'SMS_FAILED';

export type OutboundProvider = 'email' | 'sms' | 'whatsapp';

export interface ProviderConfigStatus {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
}

/**
 * Truth about which outbound providers can actually deliver right now.
 * Consumed by `/api/health` (INF-03's integration matrix) and by the send paths.
 */
export function getProviderConfigStatus(): ProviderConfigStatus {
  return {
    email: Boolean(process.env.RESEND_API_KEY),
    sms: Boolean(process.env.SMS_API_URL && process.env.SMS_API_KEY),
    whatsapp: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN),
  };
}

/** True when a raw provider error string means "credentials missing". */
export function isNotConfiguredError(error: string | undefined): boolean {
  if (!error) return false;
  return /not configured|missing environment variables/i.test(error);
}

/**
 * Maps a raw provider error to the machine-readable code callers should expose,
 * so a UI/toast can distinguish "unconfigured" from "provider rejected it".
 */
export function providerErrorCode(provider: OutboundProvider, error: string | undefined): string {
  if (isNotConfiguredError(error)) {
    if (provider === 'whatsapp') return WHATSAPP_NOT_CONFIGURED;
    if (provider === 'sms') return SMS_NOT_CONFIGURED;
    return PROVIDER_NOT_CONFIGURED;
  }
  if (provider === 'whatsapp') return WHATSAPP_FAILED;
  if (provider === 'sms') return SMS_FAILED;
  return PROVIDER_ERROR;
}

// ── Rate-limited outage logging ──────────────────────────────────────────────
// A misconfigured deployment can receive a flood of send attempts; the warning
// must be loud in logs/Sentry without becoming the flood itself.

const WARNING_THROTTLE_MS = 5 * 60 * 1000;
const lastWarnedAt = new Map<OutboundProvider, number>();

/**
 * Emits a structured, rate-limited warning (once per provider per 5 minutes).
 * Returns true when the warning was actually emitted, so tests can assert the
 * throttle rather than the log side effect.
 */
export function warnProviderNotConfigured(provider: OutboundProvider): boolean {
  const now = Date.now();
  const last = lastWarnedAt.get(provider);
  if (last !== undefined && now - last < WARNING_THROTTLE_MS) return false;

  lastWarnedAt.set(provider, now);
  const credentialHint =
    provider === 'whatsapp'
      ? 'WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_ACCESS_TOKEN'
      : provider === 'sms'
        ? 'SMS_API_URL + SMS_API_KEY'
        : 'RESEND_API_KEY';
  console.warn(
    `[integrations] ${provider} provider is NOT configured — outbound sends will fail. ` +
      `Supply ${credentialHint} (INF-03).`,
  );
  return true;
}

/** Test/reset hook — clears the throttle window. */
export function resetProviderWarningThrottle(): void {
  lastWarnedAt.clear();
}

export const PROVIDER_WARNING_THROTTLE_MS = WARNING_THROTTLE_MS;