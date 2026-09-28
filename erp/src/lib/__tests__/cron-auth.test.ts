import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isValidCronSecret } from '@/lib/cron-auth';

// M31-03 (OBS-54): the cron-secret check used to exist in several shapes — plain
// `===` in birthday-greetings, and seven near-identical inline `timingSafeEqual`
// copies. These tests pin the single shared helper's contract.
describe('isValidCronSecret', () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = 'test-cron-secret-value';
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
  });

  it('accepts the correct bearer token', () => {
    expect(isValidCronSecret('Bearer test-cron-secret-value')).toBe(true);
  });

  it('rejects a missing authorization header', () => {
    expect(isValidCronSecret(null)).toBe(false);
  });

  it('rejects an empty header', () => {
    expect(isValidCronSecret('')).toBe(false);
  });

  it('rejects a header without the Bearer prefix', () => {
    expect(isValidCronSecret('test-cron-secret-value')).toBe(false);
  });

  it('rejects a wrong token of the same length', () => {
    expect(isValidCronSecret('Bearer test-cron-secret-WRONG')).toBe(false);
  });

  it('rejects a shorter token without throwing (length-safe compare)', () => {
    expect(() => isValidCronSecret('Bearer short')).not.toThrow();
    expect(isValidCronSecret('Bearer short')).toBe(false);
  });

  it('rejects a longer token without throwing (length-safe compare)', () => {
    const longer = 'Bearer test-cron-secret-value-and-then-some';
    expect(() => isValidCronSecret(longer)).not.toThrow();
    expect(isValidCronSecret(longer)).toBe(false);
  });

  it('fails closed when CRON_SECRET is unset', () => {
    delete process.env.CRON_SECRET;
    expect(isValidCronSecret('Bearer anything')).toBe(false);
  });

  it('fails closed when CRON_SECRET is empty', () => {
    process.env.CRON_SECRET = '';
    expect(isValidCronSecret('Bearer ')).toBe(false);
  });

  it('rejects a Bearer prefix with no token', () => {
    expect(isValidCronSecret('Bearer ')).toBe(false);
  });
});

describe('isValidCronSecret timing-safety', () => {
  it('does not early-return on the first differing character', () => {
    // A plain `===` short-circuits at the first mismatch; timingSafeEqual does
    // not. Both answers must be identical, which is what the routes rely on.
    process.env.CRON_SECRET = 'aaaaaaaaaaaaaaaa';
    const spy = vi.spyOn(Buffer, 'from');
    expect(isValidCronSecret('Bearer aaaaaaaaaaaaaaab')).toBe(false);
    expect(isValidCronSecret('Bearer baaaaaaaaaaaaaaa')).toBe(false);
    spy.mockRestore();
    delete process.env.CRON_SECRET;
  });
});