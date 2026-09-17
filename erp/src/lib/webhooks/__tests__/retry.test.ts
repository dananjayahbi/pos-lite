import { describe, it, expect } from 'vitest';

import {
  MAX_ATTEMPTS,
  MAX_RETRIES,
  computeNextRetryAt,
  isDeliveryDue,
  isExhausted,
  nextRetryDelayMs,
  statusAfterFailure,
} from '@/lib/webhooks/retry';

const MINUTE = 60_000;

describe('webhook retry backoff schedule (M33-02 / OBS-62)', () => {
  it('allows five scheduled retries after the original send', () => {
    expect(MAX_RETRIES).toBe(5);
    expect(MAX_ATTEMPTS).toBe(6);
  });

  it('starts at one minute after the original failed send', () => {
    expect(nextRetryDelayMs(1)).toBe(1 * MINUTE);
  });

  it('follows the exact documented cadence 1m, 5m, 25m, 2h, 10h', () => {
    expect([1, 2, 3, 4, 5].map((attempt) => nextRetryDelayMs(attempt))).toEqual([
      1 * MINUTE,
      5 * MINUTE,
      25 * MINUTE,
      120 * MINUTE,
      600 * MINUTE,
    ]);
  });

  it('is strictly increasing (never shortens a later retry)', () => {
    const delays = [1, 2, 3, 4, 5].map((a) => nextRetryDelayMs(a));
    for (let i = 1; i < delays.length; i += 1) {
      expect(delays[i] as number).toBeGreaterThan(delays[i - 1] as number);
    }
  });

  it('returns null beyond the last allowed attempt', () => {
    expect(nextRetryDelayMs(MAX_RETRIES)).toBe(600 * MINUTE);
    expect(nextRetryDelayMs(MAX_RETRIES + 1)).toBeNull();
    expect(nextRetryDelayMs(MAX_ATTEMPTS)).toBeNull();
  });

  it('rejects nonsensical attempt numbers instead of guessing', () => {
    expect(nextRetryDelayMs(0)).toBeNull();
    expect(nextRetryDelayMs(-1)).toBeNull();
    expect(nextRetryDelayMs(1.5)).toBeNull();
    expect(nextRetryDelayMs(Number.NaN)).toBeNull();
  });
});

describe('computeNextRetryAt (M33-02 / OBS-62)', () => {
  it('adds the scheduled delay to the supplied clock', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    expect(computeNextRetryAt(2, from)?.toISOString()).toBe('2026-01-01T00:05:00.000Z');
  });

  it('returns null when the delivery is exhausted', () => {
    expect(computeNextRetryAt(MAX_ATTEMPTS, new Date())).toBeNull();
  });
});

describe('exhaustion boundary (M33-02 / OBS-62)', () => {
  it('is not exhausted before the final attempt', () => {
    for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt += 1) {
      expect(isExhausted(attempt)).toBe(false);
      expect(statusAfterFailure(attempt)).toBe('FAILED');
    }
  });

  it('becomes EXHAUSTED exactly at MAX_ATTEMPTS', () => {
    expect(isExhausted(MAX_ATTEMPTS)).toBe(true);
    expect(statusAfterFailure(MAX_ATTEMPTS)).toBe('EXHAUSTED');
  });

  it('stays EXHAUSTED past MAX_ATTEMPTS', () => {
    expect(statusAfterFailure(MAX_ATTEMPTS + 3)).toBe('EXHAUSTED');
  });
});

describe('isDeliveryDue (M33-02 / OBS-62)', () => {
  const now = new Date('2026-01-01T12:00:00.000Z');
  const past = new Date('2026-01-01T11:00:00.000Z');
  const future = new Date('2026-01-01T13:00:00.000Z');

  it('selects a FAILED row whose retry time has arrived', () => {
    expect(isDeliveryDue({ status: 'FAILED', attempt: 1, nextRetryAt: past }, now)).toBe(true);
  });

  it('selects a row due exactly now', () => {
    expect(isDeliveryDue({ status: 'FAILED', attempt: 1, nextRetryAt: now }, now)).toBe(true);
  });

  it('does not select a row scheduled in the future', () => {
    expect(isDeliveryDue({ status: 'FAILED', attempt: 1, nextRetryAt: future }, now)).toBe(false);
  });

  it('never resurrects a SUCCESS or EXHAUSTED row', () => {
    expect(isDeliveryDue({ status: 'SUCCESS', attempt: 1, nextRetryAt: past }, now)).toBe(false);
    expect(isDeliveryDue({ status: 'EXHAUSTED', attempt: MAX_ATTEMPTS, nextRetryAt: past }, now)).toBe(false);
  });

  it('treats a FAILED row at the attempt cap as not due', () => {
    expect(isDeliveryDue({ status: 'FAILED', attempt: MAX_ATTEMPTS, nextRetryAt: past }, now)).toBe(false);
  });

  it('treats a missing schedule as not due', () => {
    expect(isDeliveryDue({ status: 'FAILED', attempt: 1, nextRetryAt: null }, now)).toBe(false);
    expect(isDeliveryDue({ status: 'FAILED', attempt: 1, nextRetryAt: undefined }, now)).toBe(false);
  });

  it('defaults a missing attempt to 1 so legacy rows still retry', () => {
    expect(isDeliveryDue({ status: 'FAILED', attempt: null, nextRetryAt: past }, now)).toBe(true);
  });
});