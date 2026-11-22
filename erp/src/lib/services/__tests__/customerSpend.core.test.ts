import { describe, expect, it } from 'vitest';

import {
  EMPTY_COMPLETED_SPEND,
  filterCustomerIdsBySpend,
  matchesCompletedSpendRange,
  netSpendAfterVoid,
} from '@/lib/services/customerSpend.core';

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

/**
 * ARGUS #309: marketing segments must use completed-purchase spend, not the
 * denormalised Customer.totalSpend that includes voided/seed values.
 */
describe('completed-purchase spend rules', () => {
  it('treats a customer with no completed sale as zero spend', () => {
    expect(EMPTY_COMPLETED_SPEND).toEqual({
      totalSpend: 0,
      orderCount: 0,
      lastPurchaseAt: null,
    });
  });

  it('matches an inclusive spend range', () => {
    expect(matchesCompletedSpendRange(15000, 15000, 20000)).toBe(true);
    expect(matchesCompletedSpendRange(14999.99, 15000)).toBe(false);
    expect(matchesCompletedSpendRange(20000, undefined, 20000)).toBe(true);
    expect(matchesCompletedSpendRange(20000.01, undefined, 20000)).toBe(false);
  });

  it('excludes zero-spend customers from a minimum-spend segment', () => {
    const spend = new Map([
      ['voided-only', { totalSpend: 0, orderCount: 0, lastPurchaseAt: null }],
      ['real', { totalSpend: 16250, orderCount: 2, lastPurchaseAt: new Date() }],
    ]);

    expect(filterCustomerIdsBySpend(spend, 15000)).toEqual(['real']);
  });

  it('supports maximum-spend and unbounded segments', () => {
    const spend = new Map([
      ['a', { totalSpend: 0, orderCount: 0, lastPurchaseAt: null }],
      ['b', { totalSpend: 500, orderCount: 1, lastPurchaseAt: null }],
      ['c', { totalSpend: 5000, orderCount: 3, lastPurchaseAt: null }],
    ]);

    expect(filterCustomerIdsBySpend(spend, undefined, 500).sort()).toEqual(['a', 'b']);
    expect(filterCustomerIdsBySpend(spend, 400, 5000).sort()).toEqual(['b', 'c']);
    expect(filterCustomerIdsBySpend(spend).sort()).toEqual(['a', 'b', 'c']);
  });
});
