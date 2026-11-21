import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';

import { buildReturnAccountLegs } from '@/lib/services/saleAccounts';

/**
 * ARGUS #97 — a refund must credit the payment account that holds the money.
 */

describe('buildReturnAccountLegs', () => {
  it('credits the cash account for a cash refund', () => {
    const legs = buildReturnAccountLegs({
      refundMethod: 'CASH',
      refundAmount: '250.50',
      originalTenders: ['CASH'],
    });

    expect(legs).toHaveLength(1);
    expect(legs[0]!.method).toBe('CASH');
    expect(new Decimal(legs[0]!.amount).toNumber()).toBe(250.5);
  });

  it('credits the card account for a card-sale reversal', () => {
    const legs = buildReturnAccountLegs({
      refundMethod: 'CARD_REVERSAL',
      refundAmount: 100,
      originalTenders: ['CARD'],
    });

    expect(legs).toHaveLength(1);
    expect(legs[0]!.method).toBe('CARD');
  });

  it('credits the gateway account when the sale was paid by QR', () => {
    const legs = buildReturnAccountLegs({
      refundMethod: 'CARD_REVERSAL',
      refundAmount: 100,
      originalTenders: ['LANKAQR'],
    });

    expect(legs[0]!.method).toBe('LANKAQR');
  });

  it('prefers the card leg on a split sale', () => {
    const legs = buildReturnAccountLegs({
      refundMethod: 'CARD_REVERSAL',
      refundAmount: 100,
      originalTenders: ['CASH', 'CARD'],
    });

    expect(legs[0]!.method).toBe('CARD');
  });

  it('posts nothing for store credit or exchange', () => {
    for (const refundMethod of ['STORE_CREDIT', 'EXCHANGE'] as const) {
      expect(
        buildReturnAccountLegs({
          refundMethod,
          refundAmount: 100,
          originalTenders: ['CASH', 'CARD'],
        }),
      ).toEqual([]);
    }
  });

  it('never posts a leg when the original tender does not back the method', () => {
    expect(
      buildReturnAccountLegs({
        refundMethod: 'CASH',
        refundAmount: 100,
        originalTenders: ['CARD'],
      }),
    ).toEqual([]);
    expect(
      buildReturnAccountLegs({
        refundMethod: 'CARD_REVERSAL',
        refundAmount: 100,
        originalTenders: ['CASH'],
      }),
    ).toEqual([]);
  });

  it('ignores non-positive refund amounts', () => {
    expect(
      buildReturnAccountLegs({
        refundMethod: 'CASH',
        refundAmount: 0,
        originalTenders: ['CASH'],
      }),
    ).toEqual([]);
    expect(
      buildReturnAccountLegs({
        refundMethod: 'CASH',
        refundAmount: -10,
        originalTenders: ['CASH'],
      }),
    ).toEqual([]);
  });
});
