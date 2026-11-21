import { describe, expect, it } from 'vitest';

import { netSpendAfterVoid } from '@/lib/services/customerSpend.core';

/** ARGUS #308: voiding a sale must subtract it from lifetime spend. */
describe('netSpendAfterVoid', () => {
  it('subtracts the voided sale from lifetime spend', () => {
    expect(netSpendAfterVoid('2500.00', '2500.00').toNumber()).toBe(0);
    expect(netSpendAfterVoid('4000.00', '1500.00').toNumber()).toBe(2500);
  });

  it('never drives spend below zero', () => {
    expect(netSpendAfterVoid('100.00', '500.00').toNumber()).toBe(0);
  });

  it('keeps two-decimal precision', () => {
    expect(netSpendAfterVoid('99.99', '0.995').toNumber()).toBe(99);
  });

  it('accepts Decimal and numeric inputs', () => {
    expect(netSpendAfterVoid(1000, 250).toNumber()).toBe(750);
  });
});
