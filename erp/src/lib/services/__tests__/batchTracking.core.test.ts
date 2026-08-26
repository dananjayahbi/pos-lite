import { describe, it, expect } from 'vitest';
import {
  getBatchExpiryStatus,
  isExpiryAlertNeeded,
  daysUntilExpiry,
  describeExpiryStatus,
  EXPIRE_SOON_WINDOW_DAYS,
} from '@/lib/services/batchTracking.core';
import { evaluateBatchAlert } from '@/lib/services/batchAlert.service';

const DAY = 86_400_000;

describe('batchTracking.core — getBatchExpiryStatus', () => {
  const now = new Date('2026-01-01T00:00:00Z');

  it('returns EXPIRED for a past expiry date', () => {
    expect(getBatchExpiryStatus(new Date('2025-12-31T23:59:59Z'), now)).toBe('EXPIRED');
  });

  it('returns EXPIRING_SOON within the warning window', () => {
    const inTenDays = new Date(now.getTime() + 10 * DAY);
    expect(getBatchExpiryStatus(inTenDays, now)).toBe('EXPIRING_SOON');
  });

  it('returns OK far beyond the warning window', () => {
    const inNinetyDays = new Date(now.getTime() + 90 * DAY);
    expect(getBatchExpiryStatus(inNinetyDays, now)).toBe('OK');
  });

  it('returns OK for a null expiry date (not expiry-controlled)', () => {
    expect(getBatchExpiryStatus(null, now)).toBe('OK');
  });

  it('uses a 30-day window', () => {
    expect(EXPIRE_SOON_WINDOW_DAYS).toBe(30);
  });
});

describe('batchTracking.core — isExpiryAlertNeeded', () => {
  const now = new Date('2026-01-01T00:00:00Z');

  it('flags expired batches', () => {
    expect(isExpiryAlertNeeded(new Date('2025-12-01T00:00:00Z'), now)).toBe(true);
  });

  it('flags near-expiry batches', () => {
    expect(isExpiryAlertNeeded(new Date(now.getTime() + 5 * DAY), now)).toBe(true);
  });

  it('does not flag healthy or undated batches', () => {
    expect(isExpiryAlertNeeded(new Date(now.getTime() + 90 * DAY), now)).toBe(false);
    expect(isExpiryAlertNeeded(null, now)).toBe(false);
  });
});

describe('batchTracking.core — daysUntilExpiry', () => {
  it('returns null for undated batches', () => {
    expect(daysUntilExpiry(null)).toBeNull();
    expect(daysUntilExpiry(undefined)).toBeNull();
  });

  it('returns a negative count for already-expired batches', () => {
    const expiry = new Date(Date.now() - 3 * DAY);
    expect(daysUntilExpiry(expiry)).toBe(-3);
  });
});

describe('batchTracking.core — describeExpiryStatus', () => {
  it('returns human-readable labels', () => {
    expect(describeExpiryStatus('EXPIRED')).toBe('Expired');
    expect(describeExpiryStatus('EXPIRING_SOON')).toBe('Expiring soon');
    expect(describeExpiryStatus('OK')).toBe('Okay');
  });
});

describe('batchAlert.service — evaluateBatchAlert', () => {
  const now = Date.now();

  it('maps expired to EXPIRED severity', () => {
    expect(evaluateBatchAlert(new Date(now - 30 * DAY))).toBe('EXPIRED');
  });

  it('maps near-expiry to EXPIRING_SOON severity', () => {
    expect(evaluateBatchAlert(new Date(now + 10 * DAY))).toBe('EXPIRING_SOON');
  });

  it('returns null for healthy and undated batches', () => {
    expect(evaluateBatchAlert(new Date(now + 90 * DAY))).toBeNull();
    expect(evaluateBatchAlert(null)).toBeNull();
  });
});
