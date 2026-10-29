import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';

import { buildSaleAccountLegs } from '@/lib/services/saleAccounts';

/**
 * Which account a completed sale's money lands in.
 *
 * `buildSaleAccountLegs` is split out of `postSaleToAccounts` exactly so this
 * mapping can be asserted without a database.
 */

function total(legs: Array<{ amount: Decimal | number | string }>): number {
  return legs.reduce((sum, leg) => sum.plus(new Decimal(leg.amount)), new Decimal(0)).toNumber();
}

describe('buildSaleAccountLegs', () => {
  it('sends a cash sale entirely to the cash account', () => {
    const legs = buildSaleAccountLegs({ paymentMethod: 'CASH', totalAmount: 1500 });

    expect(legs).toHaveLength(1);
    expect(legs[0]).toMatchObject({ method: 'CASH' });
    expect(total(legs)).toBe(1500);
  });

  it('sends a card sale to the card account', () => {
    const legs = buildSaleAccountLegs({ paymentMethod: 'CARD', totalAmount: 2500 });

    expect(legs).toHaveLength(1);
    expect(legs[0]!.method).toBe('CARD');
    expect(total(legs)).toBe(2500);
  });

  it('sends a LankaQR sale to the gateway account', () => {
    const legs = buildSaleAccountLegs({ paymentMethod: 'LANKAQR', totalAmount: 800 });

    expect(legs).toHaveLength(1);
    expect(legs[0]!.method).toBe('LANKAQR');
    expect(total(legs)).toBe(800);
  });

  it('splits a split sale into a digital leg and a cash leg', () => {
    const legs = buildSaleAccountLegs({
      paymentMethod: 'SPLIT',
      totalAmount: 3000,
      cardAmount: 2000,
    });

    expect(legs).toHaveLength(2);
    const byMethod = Object.fromEntries(
      legs.map((leg) => [leg.method, new Decimal(leg.amount).toNumber()]),
    );
    expect(byMethod.CARD).toBe(2000);
    expect(byMethod.CASH).toBe(1000);
    // The legs must always sum back to the sale total.
    expect(total(legs)).toBe(3000);
  });

  it('uses the requested digital leg method for a split sale', () => {
    const legs = buildSaleAccountLegs({
      paymentMethod: 'SPLIT',
      totalAmount: 1000,
      cardAmount: 400,
      splitLegMethod: 'LANKAQR',
    });

    const byMethod = Object.fromEntries(
      legs.map((leg) => [leg.method, new Decimal(leg.amount).toNumber()]),
    );
    expect(byMethod.LANKAQR).toBe(400);
    expect(byMethod.CASH).toBe(600);
  });

  it('omits a zero-value leg in a split sale', () => {
    const legs = buildSaleAccountLegs({
      paymentMethod: 'SPLIT',
      totalAmount: 500,
      cardAmount: 500,
    });

    expect(legs).toHaveLength(1);
    expect(legs[0]!.method).toBe('CARD');
  });

  it('writes no entries for a zero-value sale', () => {
    expect(buildSaleAccountLegs({ paymentMethod: 'NONE', totalAmount: 0 })).toEqual([]);
  });

  it('writes no entries when the total is zero even with a tender method', () => {
    expect(buildSaleAccountLegs({ paymentMethod: 'CASH', totalAmount: 0 })).toEqual([]);
  });

  it('writes no entries for a negative total', () => {
    expect(buildSaleAccountLegs({ paymentMethod: 'CASH', totalAmount: -100 })).toEqual([]);
  });
});
