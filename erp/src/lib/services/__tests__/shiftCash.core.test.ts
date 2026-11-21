import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';

import {
  computeExpectedCash,
  sumShiftCashMovements,
  sumShiftRefunds,
} from '@/lib/services/shiftCash.core';
import { sumPaymentBreakdown } from '@/lib/services/paymentBreakdown';

/**
 * ARGUS #106: the close snapshot and shift-detail API used to total cash/card
 * from `Sale.paymentMethod`, which skipped SPLIT sales and hid a cash shortage.
 * Tender totals now come from payment legs and the drawer formula is shared.
 */
describe('shift cash reconciliation', () => {
  it('includes cash legs from split sales in the drawer total', () => {
    const breakdown = sumPaymentBreakdown([
      { method: 'CASH', amount: new Decimal(1000) },
      { method: 'CARD', amount: new Decimal(1000) },
      { method: 'CASH', amount: new Decimal('835.37') },
      { method: 'CARD', amount: new Decimal(1000) },
      { method: 'STORE_CREDIT', amount: new Decimal(500) },
    ]);

    expect(breakdown.cash.toNumber()).toBe(1835.37);
    expect(breakdown.card.toNumber()).toBe(2000);
    expect(breakdown.lankaqr.toNumber()).toBe(0);
  });

  it('computes expected cash from the cash legs and movements', () => {
    const expected = computeExpectedCash({
      openingFloat: 6400,
      cashSales: 7235.31,
      cashRefunds: 120,
      cashDeposited: 500,
      pettyCashOut: 200,
    });

    expect(expected.toNumber()).toBe(13815.31);
  });

  it('keeps the Z-report and close arithmetic identical', () => {
    const payments = [
      { method: 'CASH' as const, amount: new Decimal(1000) },
      { method: 'CARD' as const, amount: new Decimal(1000) },
      { method: 'CASH' as const, amount: new Decimal('835.37') },
      { method: 'CARD' as const, amount: new Decimal(1000) },
    ];
    const breakdown = sumPaymentBreakdown(payments);

    // Both paths call the same two helpers, so a split sale can never be
    // missing from one figure and present in the other.
    const closeExpected = computeExpectedCash({
      openingFloat: 0,
      cashSales: breakdown.cash,
      cashRefunds: 0,
      cashDeposited: 0,
      pettyCashOut: 0,
    });
    const zReportExpected = computeExpectedCash({
      openingFloat: 0,
      cashSales: breakdown.cash,
      cashRefunds: 0,
      cashDeposited: 0,
      pettyCashOut: 0,
    });

    expect(closeExpected.equals(zReportExpected)).toBe(true);
    expect(closeExpected.toNumber()).toBe(1835.37);
    expect(breakdown.cash.plus(breakdown.card).plus(breakdown.lankaqr).toNumber()).toBe(3835.37);
  });

  it('sums refunds and isolates cash refunds', () => {
    const totals = sumShiftRefunds([
      { refundAmount: '100.00', refundMethod: 'CASH' },
      { refundAmount: '50.00', refundMethod: 'STORE_CREDIT' },
      { refundAmount: '25.00', refundMethod: 'CARD_REVERSAL' },
    ]);

    expect(totals.total.toNumber()).toBe(175);
    expect(totals.cash.toNumber()).toBe(100);
  });

  it('separates deposits from petty cash out', () => {
    const totals = sumShiftCashMovements([
      { amount: '500.00', type: 'MANUAL_IN' },
      { amount: '120.00', type: 'MANUAL_OUT' },
      { amount: '80.00', type: 'PETTY_CASH_OUT' },
      { amount: '999.00', type: 'UNRELATED' },
    ]);

    expect(totals.deposited.toNumber()).toBe(500);
    expect(totals.pettyOut.toNumber()).toBe(200);
  });

  it('rounds the drawer total to two decimals', () => {
    const expected = computeExpectedCash({
      openingFloat: '0.005',
      cashSales: '0.005',
      cashRefunds: 0,
      cashDeposited: 0,
      pettyCashOut: 0,
    });

    expect(expected.toNumber()).toBe(0.01);
  });
});
