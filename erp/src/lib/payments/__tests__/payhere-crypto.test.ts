import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  computeCheckoutHash,
  computeInnerHash,
  computeIpnSignature,
  formatPayhereAmount,
  getPayhereMerchantSecret,
  resetSecretWarningThrottle,
  verifyPayhereSignature,
} from '@/lib/payments/payhere-crypto';

/**
 * The two PayHere signatures are the highest-risk part of the integration: a
 * wrong checkout hash makes every payment fail at the gateway ("Unauthorized
 * Payment Request") and a wrong IPN signature silently rejects every genuine
 * payment notification. These tests pin the EXACT formulas from
 * `REFERENCES/payhere/scrapes/api-and-mobile-sdk/01-checkout-api.md`.
 *
 * The formulas are re-derived here independently with node:crypto rather than
 * being imported from the module under test — otherwise the test would only
 * prove the code equals itself.
 */
const md5 = (value: string): string =>
  createHash('md5').update(value).digest('hex');

/** Independent re-derivation of the checkout hash. */
function referenceCheckoutHash(
  secret: string,
  input: { merchantId: string; orderId: string; amount: string; currency: string },
): string {
  return md5(
    input.merchantId +
      input.orderId +
      input.amount +
      input.currency +
      // UPPERCASE applies to the hex DIGEST, not to the secret.
      md5(secret).toUpperCase(),
  ).toUpperCase();
}

/** Independent re-derivation of the IPN md5sig (note the status_code). */
function referenceIpnSignature(
  secret: string,
  input: {
    merchantId: string;
    orderId: string;
    amount: string;
    currency: string;
    statusCode: string;
  },
): string {
  return md5(
    input.merchantId +
      input.orderId +
      input.amount +
      input.currency +
      input.statusCode +
      md5(secret).toUpperCase(),
  ).toUpperCase();
}

const SECRET = 'NzI3MzE2ODIxMTY1MDk1MDEwODMyNjI5MDYwNTY3Mjg3NTg1MjY=';
const MERCHANT_ID = '1238284';
const ORDER_ID = 'cmdelivery0000000000001';
const AMOUNT = '1250.00';
const CURRENCY = 'LKR';

const ORIGINAL_SECRET = process.env.PAYHERE_MERCHANT_SECRET;

function setSecret(value: string | undefined): void {
  if (value === undefined) delete process.env.PAYHERE_MERCHANT_SECRET;
  else process.env.PAYHERE_MERCHANT_SECRET = value;
}

beforeEach(() => {
  resetSecretWarningThrottle();
});

afterEach(() => {
  setSecret(ORIGINAL_SECRET);
  resetSecretWarningThrottle();
});

describe('computeInnerHash', () => {
  it('hashes the secret FIRST and uppercases the resulting hex digest', () => {
    // PayHere's contract (and every language sample on its docs page):
    //   PHP  strtoupper(md5($secret))
    //   JS   md5(secret).toString().toUpperCase()
    // The uppercase applies to the DIGEST, not to the secret.
    expect(computeInnerHash('abc')).toBe(md5('abc').toUpperCase());
  });

  it('is NOT the same as hashing the uppercased secret', () => {
    // These coincide only when the secret is already all-uppercase, which is
    // exactly why the wrong implementation looked correct. Use a secret with
    // lowercase letters, like the real sandbox secret (base64 with '=' padding).
    const secret = 'AbCdEf123+/=';
    expect(computeInnerHash(secret)).not.toBe(md5(secret.toUpperCase()));
    expect(computeInnerHash(secret)).toBe(md5(secret).toUpperCase());
  });

  it('is case-sensitive in the secret (a different case is a different key)', () => {
    expect(computeInnerHash('secret')).not.toBe(computeInnerHash('SECRET'));
  });
});

describe('computeCheckoutHash', () => {
  it('matches the documented formula — and does NOT include status_code', () => {
    const input = { merchantId: MERCHANT_ID, orderId: ORDER_ID, amount: AMOUNT, currency: CURRENCY };
    expect(computeCheckoutHash(SECRET, input)).toBe(referenceCheckoutHash(SECRET, input));
  });

  it('is uppercase hex', () => {
    const hash = computeCheckoutHash(SECRET, {
      merchantId: MERCHANT_ID,
      orderId: ORDER_ID,
      amount: AMOUNT,
      currency: CURRENCY,
    });
    expect(hash).toMatch(/^[0-9A-F]{32}$/);
  });

  it('changes when any covered field changes', () => {
    const base = { merchantId: MERCHANT_ID, orderId: ORDER_ID, amount: AMOUNT, currency: CURRENCY };
    const baseline = computeCheckoutHash(SECRET, base);
    expect(computeCheckoutHash(SECRET, { ...base, amount: '1250.01' })).not.toBe(baseline);
    expect(computeCheckoutHash(SECRET, { ...base, currency: 'USD' })).not.toBe(baseline);
    expect(computeCheckoutHash(SECRET, { ...base, orderId: 'other' })).not.toBe(baseline);
    expect(computeCheckoutHash('different-secret', base)).not.toBe(baseline);
  });
});

describe('computeIpnSignature', () => {
  it('matches the documented formula — INCLUDING status_code', () => {
    const input = {
      merchantId: MERCHANT_ID,
      orderId: ORDER_ID,
      amount: AMOUNT,
      currency: CURRENCY,
      statusCode: '2',
    };
    expect(computeIpnSignature(SECRET, input)).toBe(referenceIpnSignature(SECRET, input));
  });

  it('is NOT the same value as the checkout hash for the same order', () => {
    // This is the bug the module exists to prevent: the two signatures differ
    // only by status_code, so reusing one formula for both is silent.
    const checkout = computeCheckoutHash(SECRET, {
      merchantId: MERCHANT_ID,
      orderId: ORDER_ID,
      amount: AMOUNT,
      currency: CURRENCY,
    });
    const ipn = computeIpnSignature(SECRET, {
      merchantId: MERCHANT_ID,
      orderId: ORDER_ID,
      amount: AMOUNT,
      currency: CURRENCY,
      statusCode: '2',
    });
    expect(ipn).not.toBe(checkout);
  });
});

describe('formatPayhereAmount', () => {
  it('always produces two decimals', () => {
    expect(formatPayhereAmount(1250)).toBe('1250.00');
    expect(formatPayhereAmount('1250.5')).toBe('1250.50');
    expect(formatPayhereAmount(0)).toBe('0.00');
    expect(formatPayhereAmount(99.999)).toBe('100.00'); // toFixed rounds
  });

  it('never emits thousands separators (PayHere rejects them)', () => {
    expect(formatPayhereAmount(1234567.891)).toBe('1234567.89');
    expect(formatPayhereAmount(1234567.891)).not.toContain(',');
  });

  it('throws on a non-numeric amount instead of sending NaN to the gateway', () => {
    expect(() => formatPayhereAmount('not-a-number')).toThrow(TypeError);
  });
});

describe('getPayhereMerchantSecret', () => {
  it('returns null when unset', () => {
    setSecret(undefined);
    expect(getPayhereMerchantSecret()).toBeNull();
  });

  it('returns null for a whitespace-only value (misconfiguration, not a secret)', () => {
    setSecret('   ');
    expect(getPayhereMerchantSecret()).toBeNull();
  });

  it('returns the secret untouched so hashing is unchanged', () => {
    setSecret(SECRET);
    expect(getPayhereMerchantSecret()).toBe(SECRET);
  });
});

describe('verifyPayhereSignature', () => {
  const base = {
    merchantId: MERCHANT_ID,
    orderId: ORDER_ID,
    amount: AMOUNT,
    currency: CURRENCY,
    statusCode: '2',
  };

  it('accepts a genuinely-signed success notification', () => {
    setSecret(SECRET);
    const md5sig = referenceIpnSignature(SECRET, base);
    expect(verifyPayhereSignature({ ...base, md5sig })).toEqual({
      valid: true,
      reason: null,
    });
  });

  it('accepts an UPPERCASE signature — the only casing the gateway sends', () => {
    setSecret(SECRET);
    const md5sig = referenceIpnSignature(SECRET, base).toUpperCase();
    expect(verifyPayhereSignature({ ...base, md5sig }).valid).toBe(true);
  });

  it('rejects a lowercased signature (the contract uppercases the digest)', () => {
    // Widening the gate to any casing buys nothing — PayHere only ever sends
    // uppercase — and it weakens a security check for no benefit.
    setSecret(SECRET);
    const md5sig = referenceIpnSignature(SECRET, base).toLowerCase();
    expect(verifyPayhereSignature({ ...base, md5sig })).toEqual({
      valid: false,
      reason: 'BAD_SIGNATURE',
    });
  });

  it('rejects a forged signature', () => {
    setSecret(SECRET);
    expect(verifyPayhereSignature({ ...base, md5sig: 'deadbeef' })).toEqual({
      valid: false,
      reason: 'BAD_SIGNATURE',
    });
  });

  it('rejects a notification signed WITHOUT status_code (the checkout-hash shape)', () => {
    // A real attack surface: if the gate had used the checkout formula this
    // forgery would pass. Pin that it does not.
    setSecret(SECRET);
    const checkoutShaped = referenceCheckoutHash(SECRET, base);
    expect(
      verifyPayhereSignature({ ...base, md5sig: checkoutShaped }),
    ).toEqual({ valid: false, reason: 'BAD_SIGNATURE' });
  });

  it('rejects a signature that is valid for a DIFFERENT amount', () => {
    setSecret(SECRET);
    const md5sig = referenceIpnSignature(SECRET, { ...base, amount: '1.00' });
    expect(verifyPayhereSignature({ ...base, md5sig }).reason).toBe('BAD_SIGNATURE');
  });

  it('rejects with SECRET_NOT_CONFIGURED when no secret is set (never a silent pass)', () => {
    setSecret(undefined);
    const md5sig = referenceIpnSignature('', base); // what a rogue caller would compute
    expect(verifyPayhereSignature({ ...base, md5sig })).toEqual({
      valid: false,
      reason: 'SECRET_NOT_CONFIGURED',
    });
  });

  it('SECRET_NOT_CONFIGURED takes precedence over a bad signature', () => {
    setSecret(undefined);
    expect(verifyPayhereSignature({ ...base, md5sig: 'bogus' }).reason).toBe(
      'SECRET_NOT_CONFIGURED',
    );
  });

  it('rejects a notification for a different merchant/order even with a valid formula', () => {
    setSecret(SECRET);
    const md5sig = referenceIpnSignature(SECRET, { ...base, orderId: 'someone-elses' });
    expect(verifyPayhereSignature({ ...base, md5sig }).reason).toBe('BAD_SIGNATURE');
  });
});
