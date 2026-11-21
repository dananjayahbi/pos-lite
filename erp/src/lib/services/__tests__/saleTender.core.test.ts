import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';

import { buildSaleTenderLegs } from '@/lib/services/saleTender.core';

function legMap(legs: ReturnType<typeof buildSaleTenderLegs>): Record<string, number> {
  return Object.fromEntries(legs.map((leg) => [leg.method, leg.amount.toNumber()]));
}

function legsTotal(legs: ReturnType<typeof buildSaleTenderLegs>): number {
  return legs
    .reduce((sum, leg) => sum.plus(leg.amount), new Decimal(0))
    .toDecimalPlaces(2)
    .toNumber();
}

/**
 * ARGUS #61: store credit must be persisted as a tender. The cash/card leg has
 * to settle only what is still payable, and the credit leg the rest, so the
 * saved payments always add up to the saved sale total.
 */
describe('buildSaleTenderLegs', () => {
  it('keeps a plain cash sale unchanged', () => {
    const legs = buildSaleTenderLegs({
      paymentMethod: 'CASH',
      payableAmount: new Decimal('2184.75'),
      creditAmount: new Decimal(0),
    });

    expect(legMap(legs)).toEqual({ CASH: 2184.75 });
    expect(legsTotal(legs)).toBe(2184.75);
  });

  it('charges cash only for the remainder and records the credit leg', () => {
    const legs = buildSaleTenderLegs({
      paymentMethod: 'CASH',
      payableAmount: new Decimal('684.75'),
      creditAmount: new Decimal('1500.00'),
    });

    expect(legMap(legs)).toEqual({ CASH: 684.75, STORE_CREDIT: 1500 });
    expect(legsTotal(legs)).toBe(2184.75);
  });

  it('records only the credit leg when credit covers the whole sale', () => {
    const legs = buildSaleTenderLegs({
      paymentMethod: 'STORE_CREDIT',
      payableAmount: new Decimal(0),
      creditAmount: new Decimal('100.00'),
    });

    expect(legMap(legs)).toEqual({ STORE_CREDIT: 100 });
  });

  it('splits a card-and-credit sale', () => {
    const legs = buildSaleTenderLegs({
      paymentMethod: 'CARD',
      payableAmount: new Decimal('400.00'),
      creditAmount: new Decimal('600.00'),
    });

    expect(legMap(legs)).toEqual({ CARD: 400, STORE_CREDIT: 600 });
    expect(legsTotal(legs)).toBe(1000);
  });

  it('splits card/cash around the payable amount, leaving credit intact', () => {
    const legs = buildSaleTenderLegs({
      paymentMethod: 'SPLIT',
      payableAmount: new Decimal('500.00'),
      creditAmount: new Decimal('300.00'),
      cardAmount: new Decimal('200.00'),
    });

    expect(legMap(legs)).toEqual({ CARD: 200, CASH: 300, STORE_CREDIT: 300 });
    expect(legsTotal(legs)).toBe(800);
  });

  it('omits the cash leg when the split is entirely digital', () => {
    const legs = buildSaleTenderLegs({
      paymentMethod: 'SPLIT',
      payableAmount: new Decimal('250.00'),
      creditAmount: new Decimal(0),
      cardAmount: new Decimal('250.00'),
      splitLegMethod: 'LANKAQR',
    });

    expect(legMap(legs)).toEqual({ LANKAQR: 250 });
  });

  it('creates no legs for a zero-value sale', () => {
    const legs = buildSaleTenderLegs({
      paymentMethod: 'NONE',
      payableAmount: new Decimal(0),
      creditAmount: new Decimal(0),
    });

    expect(legs).toEqual([]);
  });

  it('applies an exchange credit and collects only the remainder', () => {
    const legs = buildSaleTenderLegs({
      paymentMethod: 'CASH',
      payableAmount: new Decimal('500.00'),
      creditAmount: new Decimal(0),
      exchangeCreditAmount: new Decimal('1240.40'),
    });

    expect(legMap(legs)).toEqual({ CASH: 500, EXCHANGE_CREDIT: 1240.4 });
    expect(legsTotal(legs)).toBe(1740.4);
  });

  it('records only the exchange leg when the return covers the sale', () => {
    const legs = buildSaleTenderLegs({
      paymentMethod: 'EXCHANGE_CREDIT',
      payableAmount: new Decimal(0),
      creditAmount: new Decimal(0),
      exchangeCreditAmount: new Decimal('980.25'),
    });

    expect(legMap(legs)).toEqual({ EXCHANGE_CREDIT: 980.25 });
  });

  it('stacks store credit and exchange credit before the tender', () => {
    const legs = buildSaleTenderLegs({
      paymentMethod: 'CARD',
      payableAmount: new Decimal('100.00'),
      creditAmount: new Decimal('300.00'),
      exchangeCreditAmount: new Decimal('200.00'),
    });

    expect(legMap(legs)).toEqual({ CARD: 100, STORE_CREDIT: 300, EXCHANGE_CREDIT: 200 });
    expect(legsTotal(legs)).toBe(600);
  });
});
