/**
 * M30-02 / M30-03 — unit coverage for the extracted PayHere IPN signature gate.
 *
 * The module under test is pure except for `process.env.PAYHERE_MERCHANT_SECRET`
 * and one `console.warn`, so no DB/Next runtime is involved. The MD5 vector is
 * pinned as a literal (computed independently with node:crypto) to lock the
 * exact PayHere algorithm the route used before extraction — including the
 * `secret.toUpperCase()` inner hash. A silent change there would otherwise be
 * invisible until production IPNs stopped processing (BUG-71).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  computePayhereSignature,
  getPayhereMerchantSecret,
  resetSecretWarningThrottle,
  SECRET_WARNING_THROTTLE_MS,
  verifyPayhereSignature,
  warnSecretNotConfigured,
} from '@/lib/billing/payhere-signature';

const ORIGINAL_SECRET = process.env.PAYHERE_MERCHANT_SECRET;

const SECRET = 'qa-secret-abc';
const FIELDS = {
  merchantId: '123456',
  orderId: 'inv_abc123',
  amount: '1000.00',
  currency: 'LKR',
};

/**
 * md5('123456' + 'inv_abc123' + '1000.00' + 'LKR' + md5('QA-SECRET-ABC'))
 * Note the inner hash uses the UPPERCASED secret — PayHere's contract.
 */
const VALID_SIG = '2dfe5ce49f96deae63b98e66b075af3c';

/** Same concatenation but with md5('qa-secret-abc') — i.e. WITHOUT the
 *  `toUpperCase()` step. Must never verify against VALID_SIG. */
const SIG_WITHOUT_UPPERCASE = '617fc10a2bb5e206973c8fc3c14ad925';

/** What the pre-fix code computed when the env var was unset (md5('')). */
const EMPTY_SECRET_SIG = '62fa30019a4a38b2a3a9dbf64fe24588';

function setSecret(value: string | undefined): void {
  if (value === undefined) delete process.env.PAYHERE_MERCHANT_SECRET;
  else process.env.PAYHERE_MERCHANT_SECRET = value;
}

beforeEach(() => {
  setSecret(SECRET);
  resetSecretWarningThrottle();
});

afterEach(() => {
  setSecret(ORIGINAL_SECRET);
  resetSecretWarningThrottle();
  vi.restoreAllMocks();
});

describe('verifyPayhereSignature', () => {
  describe('correct signature', () => {
    it('accepts a matching signature and reports reason null', () => {
      expect(verifyPayhereSignature({ ...FIELDS, md5sig: VALID_SIG })).toEqual({
        valid: true,
        reason: null,
      });
    });

    it('accepts an uppercase hex signature (gateway casing tolerance)', () => {
      expect(
        verifyPayhereSignature({
          ...FIELDS,
          md5sig: VALID_SIG.toUpperCase(),
        }),
      ).toEqual({ valid: true, reason: null });
    });

    it('does not warn when the secret is configured', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      verifyPayhereSignature({ ...FIELDS, md5sig: VALID_SIG });
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('wrong signature', () => {
    it('rejects a mismatched signature with BAD_SIGNATURE', () => {
      expect(
        verifyPayhereSignature({ ...FIELDS, md5sig: 'bogus' }),
      ).toEqual({ valid: false, reason: 'BAD_SIGNATURE' });
    });

    it('rejects an empty signature with BAD_SIGNATURE', () => {
      expect(
        verifyPayhereSignature({ ...FIELDS, md5sig: '' }),
      ).toEqual({ valid: false, reason: 'BAD_SIGNATURE' });
    });

    it('rejects a signature computed without the secret-toUpperCase step', () => {
      expect(
        verifyPayhereSignature({ ...FIELDS, md5sig: SIG_WITHOUT_UPPERCASE }),
      ).toEqual({ valid: false, reason: 'BAD_SIGNATURE' });
    });

    it('rejects a valid signature for a DIFFERENT order/amount (tampering)', () => {
      expect(
        verifyPayhereSignature({
          ...FIELDS,
          amount: '1.00',
          md5sig: VALID_SIG,
        }),
      ).toEqual({ valid: false, reason: 'BAD_SIGNATURE' });
    });
  });

  describe('secret not configured', () => {
    it('reports SECRET_NOT_CONFIGURED when the env var is unset', () => {
      setSecret(undefined);
      expect(
        verifyPayhereSignature({ ...FIELDS, md5sig: VALID_SIG }),
      ).toEqual({ valid: false, reason: 'SECRET_NOT_CONFIGURED' });
    });

    it('reports SECRET_NOT_CONFIGURED for an empty string secret', () => {
      setSecret('');
      expect(
        verifyPayhereSignature({ ...FIELDS, md5sig: VALID_SIG }),
      ).toEqual({ valid: false, reason: 'SECRET_NOT_CONFIGURED' });
    });

    it('reports SECRET_NOT_CONFIGURED for a whitespace-only secret', () => {
      setSecret('   ');
      expect(
        verifyPayhereSignature({ ...FIELDS, md5sig: VALID_SIG }),
      ).toEqual({ valid: false, reason: 'SECRET_NOT_CONFIGURED' });
    });

    it('still rejects a hash that would be correct for an empty secret (never loosens the gate)', () => {
      setSecret(undefined);
      expect(
        verifyPayhereSignature({ ...FIELDS, md5sig: EMPTY_SECRET_SIG }),
      ).toEqual({ valid: false, reason: 'SECRET_NOT_CONFIGURED' });
    });

    it('takes precedence over BAD_SIGNATURE so ops can alert on misconfiguration', () => {
      setSecret(undefined);
      expect(
        verifyPayhereSignature({ ...FIELDS, md5sig: 'bogus' }),
      ).toEqual({ valid: false, reason: 'SECRET_NOT_CONFIGURED' });
    });

    it('emits a distinct server-side warning when unconfigured', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      setSecret(undefined);
      verifyPayhereSignature({ ...FIELDS, md5sig: VALID_SIG });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain(
        'PAYHERE_MERCHANT_SECRET is not configured',
      );
    });
  });
});

describe('getPayhereMerchantSecret', () => {
  it('returns the configured secret untouched', () => {
    setSecret(SECRET);
    expect(getPayhereMerchantSecret()).toBe(SECRET);
  });

  it('returns null when unset, empty or whitespace-only', () => {
    setSecret(undefined);
    expect(getPayhereMerchantSecret()).toBeNull();
    setSecret('');
    expect(getPayhereMerchantSecret()).toBeNull();
    setSecret('  ');
    expect(getPayhereMerchantSecret()).toBeNull();
  });
});

describe('computePayhereSignature', () => {
  it('matches the pinned PayHere MD5 vector', () => {
    expect(computePayhereSignature(SECRET, FIELDS)).toBe(VALID_SIG);
  });

  it('uppercases the secret before the inner hash (case-insensitive secret)', () => {
    expect(computePayhereSignature(SECRET.toUpperCase(), FIELDS)).toBe(
      VALID_SIG,
    );
    expect(computePayhereSignature(SECRET, FIELDS)).toBe(
      computePayhereSignature(SECRET.toUpperCase(), FIELDS),
    );
  });

  it('differs from a hash computed without the toUpperCase step', () => {
    expect(computePayhereSignature(SECRET, FIELDS)).not.toBe(
      SIG_WITHOUT_UPPERCASE,
    );
  });

  it('is sensitive to every field of the concatenation', () => {
    const base = computePayhereSignature(SECRET, FIELDS);
    expect(computePayhereSignature(SECRET, { ...FIELDS, merchantId: '654321' })).not.toBe(base);
    expect(computePayhereSignature(SECRET, { ...FIELDS, orderId: 'other' })).not.toBe(base);
    expect(computePayhereSignature(SECRET, { ...FIELDS, amount: '1000.01' })).not.toBe(base);
    expect(computePayhereSignature(SECRET, { ...FIELDS, currency: 'USD' })).not.toBe(base);
  });
});

describe('warnSecretNotConfigured (rate-limited)', () => {
  it('logs once and throttles the rest inside the window', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t0 = 1_000_000;

    expect(warnSecretNotConfigured(t0)).toBe(true);
    expect(warnSecretNotConfigured(t0 + 1)).toBe(false);
    expect(warnSecretNotConfigured(t0 + SECRET_WARNING_THROTTLE_MS - 1)).toBe(
      false,
    );
    expect(warn).toHaveBeenCalledTimes(1);

    // A flood of IPNs must not spam logs/Sentry.
    for (let i = 0; i < 100; i += 1) {
      warnSecretNotConfigured(t0 + 2 + i);
    }
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('logs again once the throttle window has elapsed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t0 = 2_000_000;

    expect(warnSecretNotConfigured(t0)).toBe(true);
    expect(
      warnSecretNotConfigured(t0 + SECRET_WARNING_THROTTLE_MS),
    ).toBe(true);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('is re-armed by resetSecretWarningThrottle (test hook)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(warnSecretNotConfigured(3_000_000)).toBe(true);
    expect(warnSecretNotConfigured(3_000_001)).toBe(false);
    resetSecretWarningThrottle();
    expect(warnSecretNotConfigured(3_000_002)).toBe(true);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});