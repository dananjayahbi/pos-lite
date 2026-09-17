import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';

import { WEBHOOK_TIMEOUT_MS, signWebhookPayload } from '@/lib/webhooks/send';

/**
 * M33-03 (OBS-64) — the signature must cover the timestamp so a captured
 * body+signature pair cannot be replayed outside the receiver's tolerance window.
 */
describe('signWebhookPayload (M33-03 / OBS-64)', () => {
  const secret = 'whsec_test_0123456789';
  const timestamp = 1_767_225_600; // 2026-01-01T00:00:00Z
  const body = JSON.stringify({ event: 'sale.created', payload: { id: 'sale_1' } });

  it('matches the documented `${timestamp}.${body}` HMAC-SHA256 scheme', () => {
    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.${body}`)
      .digest('hex');
    expect(signWebhookPayload(secret, timestamp, body)).toBe(expected);
  });

  it('is stable for identical inputs', () => {
    expect(signWebhookPayload(secret, timestamp, body)).toBe(
      signWebhookPayload(secret, timestamp, body),
    );
  });

  it('changes when the body is tampered with', () => {
    const tampered = JSON.stringify({ event: 'sale.created', payload: { id: 'sale_2' } });
    expect(signWebhookPayload(secret, timestamp, tampered)).not.toBe(
      signWebhookPayload(secret, timestamp, body),
    );
  });

  it('changes when the timestamp differs, which is what blocks replay', () => {
    expect(signWebhookPayload(secret, timestamp + 1, body)).not.toBe(
      signWebhookPayload(secret, timestamp, body),
    );
  });

  it('changes when the secret differs', () => {
    expect(signWebhookPayload('whsec_other', timestamp, body)).not.toBe(
      signWebhookPayload(secret, timestamp, body),
    );
  });

  it('does not leak the secret into the digest', () => {
    expect(signWebhookPayload(secret, timestamp, body)).not.toContain(secret);
  });

  it('is a lowercase 64-char hex digest', () => {
    expect(signWebhookPayload(secret, timestamp, body)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('shared webhook timeout (M33-02 / OBS-65)', () => {
  it('exposes one 5s constant for every dispatch path', () => {
    expect(WEBHOOK_TIMEOUT_MS).toBe(5_000);
  });
});