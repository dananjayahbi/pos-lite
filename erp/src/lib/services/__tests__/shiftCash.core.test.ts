import { describe, expect, it } from 'vitest';
import Decimal from 'decimal.js';

import {
  computeExpectedCash,
  computeShiftClosureFigures,
  filterReturnsForShift,
  resolveReturnShiftId,
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

  it('keeps one authoritative difference for the shift detail page', () => {
    // CMU4USAR1: the old closure ignored the 500 cash refund and 35 petty cash
    // and reported 0.00. The payment-leg view shows a 535.00 shortage.
    const expected = computeExpectedCash({
      openingFloat: 0,
      cashSales: 30668.36,
      cashRefunds: 500,
      cashDeposited: 0,
      pettyCashOut: 35,
    });
    const actualCashCounted = new Decimal(30668.36);

    expect(expected.toNumber()).toBe(30133.36);
    expect(actualCashCounted.minus(expected).toNumber()).toBe(535);
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

describe('return shift attribution', () => {
  const at = (iso: string) => new Date(iso);

  // The two overlapping Sep 13-17 shifts from the report (ARGUS #109).
  const shiftA = {
    id: 'shift-a',
    cashierId: 'cashier-1',
    openedAt: at('2026-09-13T08:00:00Z'),
    closedAt: at('2026-09-17T18:00:00Z'),
  };
  const shiftB = {
    id: 'shift-b',
    cashierId: 'cashier-2',
    openedAt: at('2026-09-13T09:00:00Z'),
    closedAt: at('2026-09-17T18:00:00Z'),
  };

  it('attributes a return to the shift that recorded the original sale', () => {
    const ret = {
      originalSaleShiftId: 'shift-a',
      initiatedById: 'cashier-2',
      createdAt: at('2026-09-15T12:00:00Z'),
    };

    expect(resolveReturnShiftId(ret, [shiftA, shiftB])).toBe('shift-a');
    expect(filterReturnsForShift([ret], [shiftA, shiftB], 'shift-a')).toHaveLength(1);
    expect(filterReturnsForShift([ret], [shiftA, shiftB], 'shift-b')).toHaveLength(0);
  });

  it('falls back to the initiator shift for a legacy shiftless sale', () => {
    const ret = {
      originalSaleShiftId: null,
      initiatedById: 'cashier-1',
      createdAt: at('2026-09-15T12:00:00Z'),
    };

    expect(resolveReturnShiftId(ret, [shiftA, shiftB])).toBe('shift-a');
    expect(filterReturnsForShift([ret], [shiftA, shiftB], 'shift-b')).toHaveLength(0);
  });

  it('gives an overlapping same-cashier return exactly one owner', () => {
    const later = {
      id: 'shift-a-later',
      cashierId: 'cashier-1',
      openedAt: at('2026-09-14T08:00:00Z'),
      closedAt: at('2026-09-16T18:00:00Z'),
    };
    const ret = {
      originalSaleShiftId: null,
      initiatedById: 'cashier-1',
      createdAt: at('2026-09-15T12:00:00Z'),
    };

    expect(resolveReturnShiftId(ret, [shiftA, later])).toBe('shift-a-later');
    expect(filterReturnsForShift([ret], [shiftA, later], 'shift-a')).toHaveLength(0);
    expect(filterReturnsForShift([ret], [shiftA, later], 'shift-a-later')).toHaveLength(1);
  });

  it('breaks an openedAt tie deterministically by shift id', () => {
    const first = { ...shiftA, id: 'shift-a' };
    const second = { ...shiftA, id: 'shift-b' };
    const ret = {
      originalSaleShiftId: null,
      initiatedById: 'cashier-1',
      createdAt: at('2026-09-15T12:00:00Z'),
    };

    expect(resolveReturnShiftId(ret, [second, first])).toBe('shift-a');
  });

  it('never guesses a legacy return onto another cashier shift', () => {
    const ret = {
      originalSaleShiftId: null,
      initiatedById: 'cashier-3',
      createdAt: at('2026-09-15T12:00:00Z'),
    };

    expect(resolveReturnShiftId(ret, [shiftA, shiftB])).toBeNull();
    expect(filterReturnsForShift([ret], [shiftA, shiftB], 'shift-a')).toHaveLength(0);
    expect(filterReturnsForShift([ret], [shiftA, shiftB], 'shift-b')).toHaveLength(0);
  });
});

describe('computeShiftClosureFigures', () => {
  it('derives every stored closure figure from legs, refunds and movements', () => {
    const figures = computeShiftClosureFigures({
      payments: [
        { method: 'CASH', amount: new Decimal('7235.31') },
        { method: 'CARD', amount: new Decimal(1000) },
        { method: 'LANKAQR', amount: new Decimal(50) },
        { method: 'STORE_CREDIT', amount: new Decimal(200) },
      ],
      returns: [
        { refundAmount: '500', refundMethod: 'CASH' },
        { refundAmount: '35', refundMethod: 'STORE_CREDIT' },
      ],
      cashMovements: [
        { amount: '100', type: 'MANUAL_IN' },
        { amount: '35', type: 'PETTY_CASH_OUT' },
      ],
      openingFloat: 6400,
    });

    expect(figures.totalCash.toNumber()).toBe(7235.31);
    expect(figures.totalCard.toNumber()).toBe(1000);
    expect(figures.totalQr.toNumber()).toBe(50);
    expect(figures.totalReturns.toNumber()).toBe(535);
    expect(figures.totalReturnsCount).toBe(2);
    expect(figures.cashRefunds.toNumber()).toBe(500);
    expect(figures.cashDeposited.toNumber()).toBe(100);
    expect(figures.pettyOut.toNumber()).toBe(35);
    expect(figures.expectedCash.toNumber()).toBe(13200.31);
  });
});
