import { afterEach, describe, expect, it } from 'vitest';
import {
  getProviderConfigStatus,
  isNotConfiguredError,
  PROVIDER_NOT_CONFIGURED,
  PROVIDER_WARNING_THROTTLE_MS,
  providerErrorCode,
  resetProviderWarningThrottle,
  warnProviderNotConfigured,
  WHATSAPP_FAILED,
  WHATSAPP_NOT_CONFIGURED,
} from '@/lib/notifications/provider-status';

// M31-01 (BUG-73): an unconfigured comms provider used to fail silently behind
// a healthy-looking 200. These tests pin the visibility contract introduced to
// fix that: a truthful status matrix, a machine-readable reason code, and a
// rate-limited warning so the outage is loud in logs without becoming a flood.
describe('getProviderConfigStatus', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env.RESEND_API_KEY = original.RESEND_API_KEY;
    process.env.WHATSAPP_PHONE_NUMBER_ID = original.WHATSAPP_PHONE_NUMBER_ID;
    process.env.WHATSAPP_ACCESS_TOKEN = original.WHATSAPP_ACCESS_TOKEN;
  });

  it('reports both providers unconfigured when keys are absent', () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_ACCESS_TOKEN;

    expect(getProviderConfigStatus()).toEqual({ email: false, whatsapp: false });
  });

  it('reports email configured when RESEND_API_KEY is present', () => {
    process.env.RESEND_API_KEY = 're_test_key';
    expect(getProviderConfigStatus().email).toBe(true);
  });

  it('requires BOTH whatsapp keys for whatsapp to count as configured', () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = '123456';
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    expect(getProviderConfigStatus().whatsapp).toBe(false);

    process.env.WHATSAPP_ACCESS_TOKEN = 'token';
    expect(getProviderConfigStatus().whatsapp).toBe(true);
  });
});

describe('providerErrorCode', () => {
  it('maps a missing-credential message to the not-configured code', () => {
    expect(providerErrorCode('whatsapp', 'WhatsApp is not configured. Missing environment variables.')).toBe(
      WHATSAPP_NOT_CONFIGURED,
    );
    expect(providerErrorCode('email', 'provider not configured')).toBe(PROVIDER_NOT_CONFIGURED);
  });

  it('maps a real provider rejection to the failed code', () => {
    expect(providerErrorCode('whatsapp', 'Meta API returned HTTP status 400.')).toBe(WHATSAPP_FAILED);
  });

  it('treats an undefined error as a plain provider failure', () => {
    expect(providerErrorCode('whatsapp', undefined)).toBe(WHATSAPP_FAILED);
  });

  it('classifies the not-configured case case-insensitively', () => {
    expect(isNotConfiguredError('WhatsApp is NOT CONFIGURED')).toBe(true);
    expect(isNotConfiguredError(undefined)).toBe(false);
  });
});

describe('warnProviderNotConfigured', () => {
  afterEach(() => {
    resetProviderWarningThrottle();
  });

  it('emits the first warning for a provider', () => {
    expect(warnProviderNotConfigured('email')).toBe(true);
  });

  it('throttles repeat warnings inside the window', () => {
    expect(warnProviderNotConfigured('email')).toBe(true);
    expect(warnProviderNotConfigured('email')).toBe(false);
    expect(warnProviderNotConfigured('email')).toBe(false);
  });

  it('throttles per provider, not globally', () => {
    expect(warnProviderNotConfigured('email')).toBe(true);
    expect(warnProviderNotConfigured('whatsapp')).toBe(true);
  });

  it('exposes a sane throttle window', () => {
    expect(PROVIDER_WARNING_THROTTLE_MS).toBeGreaterThanOrEqual(60_000);
  });
});