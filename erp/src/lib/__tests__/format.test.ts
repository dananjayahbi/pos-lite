import { describe, expect, it } from 'vitest';

import { formatRupee, formatSignedRupee, normalizeRupeeText } from '@/lib/format';

/** ARGUS #57: notification money must be grouped and sign-prefixed. */
describe('formatSignedRupee', () => {
  it('groups thousands for positive amounts', () => {
    expect(formatSignedRupee(2476.58)).toBe('Rs. 2,476.58');
  });

  it('puts the minus before the currency', () => {
    expect(formatSignedRupee(-1156.7)).toBe('-Rs. 1,156.70');
    expect(formatSignedRupee('-1156.70')).toBe('-Rs. 1,156.70');
  });

  it('falls back to zero for a non-numeric value', () => {
    expect(formatSignedRupee('not-a-number')).toBe('Rs. 0.00');
    expect(formatRupee('not-a-number')).toBe('Rs. 0.00');
  });
});

describe('normalizeRupeeText', () => {
  it('formats legacy stored bodies without touching the wording', () => {
    expect(normalizeRupeeText('Sale #A1B2C3D4 completed for Rs. 2476.58.')).toBe(
      'Sale #A1B2C3D4 completed for Rs. 2,476.58.',
    );
    expect(normalizeRupeeText('Refund of Rs. -1156.70 recorded.')).toBe(
      'Refund of -Rs. 1,156.70 recorded.',
    );
  });

  it('leaves already-normalised amounts and unrelated text alone', () => {
    expect(normalizeRupeeText('Rs. 2,476.58 and -Rs. 1,156.70')).toBe(
      'Rs. 2,476.58 and -Rs. 1,156.70',
    );
    expect(normalizeRupeeText('No money in this row.')).toBe('No money in this row.');
  });
});
