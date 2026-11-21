import { describe, expect, it } from 'vitest';

import {
  describeCommissionBalance,
  getCommissionRecordStatus,
  summarizeCommissionAmounts,
  type CommissionAmountRow,
} from '@/lib/services/commissionSummary.core';

function row(overrides: Partial<CommissionAmountRow> = {}): CommissionAmountRow {
  return { earnedAmount: '100.00', paidAmount: '0.00', ...overrides };
}

/**
 * ARGUS #337 — the staff detail tab summed only the current page and treated
 * `isPaid` as paid, so legacy "paid" rows with no money inflated Total Paid
 * and the badges changed with pagination.
 */
describe('getCommissionRecordStatus', () => {
  it('is PAID only when money covers the earned amount', () => {
    expect(getCommissionRecordStatus(row({ earnedAmount: '144.39', paidAmount: '144.39' }))).toBe(
      'PAID',
    );
  });

  it('is PARTIAL when some money was recorded', () => {
    expect(getCommissionRecordStatus(row({ earnedAmount: '144.39', paidAmount: '40.00' }))).toBe(
      'PARTIAL',
    );
  });

  it('is UNPAID for a legacy isPaid row with no money and no payout', () => {
    expect(
      getCommissionRecordStatus(
        row({ earnedAmount: '144.39', paidAmount: '0.00', isPaid: true, payoutId: null }),
      ),
    ).toBe('UNPAID');
  });

  it('treats a payout-backed row as PAID regardless of the flag', () => {
    expect(
      getCommissionRecordStatus(
        row({ earnedAmount: '100.00', paidAmount: '100.00', isPaid: false, payoutId: 'payout_1' }),
      ),
    ).toBe('PAID');
  });

  it('handles Decimal-like values and zero rows', () => {
    expect(
      getCommissionRecordStatus({
        earnedAmount: { toString: () => '50.00' },
        paidAmount: { toString: () => '25.00' },
      }),
    ).toBe('PARTIAL');
    expect(getCommissionRecordStatus({ earnedAmount: 0, paidAmount: 0 })).toBe('UNPAID');
  });
});

describe('summarizeCommissionAmounts', () => {
  it('sums the full ledger and ignores isPaid without money', () => {
    const totals = summarizeCommissionAmounts([
      row({ earnedAmount: '144.39', paidAmount: '0.00', isPaid: true }),
      row({ earnedAmount: '144.39', paidAmount: '40.00', isPaid: false }),
      row({ earnedAmount: '136.31', paidAmount: '136.31', isPaid: true, payoutId: 'payout_1' }),
    ]);

    expect(totals).toEqual({
      totalEarned: '425.09',
      totalPaid: '176.31',
      unpaid: '248.78',
      counts: { total: 3, paid: 1, partial: 1, unpaid: 1 },
    });
  });

  it('reports an all-unpaid ledger when no payout money exists', () => {
    // Live cashier1 before the fix: three records, all isPaid flags wrong,
    // paidAmount 0 everywhere, no payout history.
    const totals = summarizeCommissionAmounts([
      row({ earnedAmount: '149.22', isPaid: true }),
      row({ earnedAmount: '144.39', isPaid: false }),
      row({ earnedAmount: '131.48', isPaid: true }),
    ]);

    expect(totals.totalEarned).toBe('425.09');
    expect(totals.totalPaid).toBe('0.00');
    expect(totals.unpaid).toBe('425.09');
    expect(totals.counts).toEqual({ total: 3, paid: 0, partial: 0, unpaid: 3 });
  });

  it('nets negative return adjustments into the balance', () => {
    const totals = summarizeCommissionAmounts([
      row({ earnedAmount: '200.00', paidAmount: '200.00' }),
      row({ earnedAmount: '-20.00', paidAmount: '0.00' }),
    ]);

    expect(totals.totalEarned).toBe('180.00');
    expect(totals.totalPaid).toBe('200.00');
    expect(totals.unpaid).toBe('-20.00');
  });

  it('is independent of pagination when fed the full ledger', () => {
    const ledger = Array.from({ length: 25 }, (_, index) =>
      row({
        earnedAmount: '100.00',
        // Paid records are spread across pages, so a page slice can never
        // reproduce the ledger balance.
        paidAmount: index % 3 === 0 ? '100.00' : '0.00',
      }),
    );

    const full = summarizeCommissionAmounts(ledger);
    const firstPage = summarizeCommissionAmounts(ledger.slice(0, 10));

    expect(full.totalEarned).toBe('2500.00');
    expect(full.totalPaid).toBe('900.00');
    expect(full.unpaid).toBe('1600.00');
    // A page slice is NOT the balance — the service must use aggregates.
    expect(firstPage.totalPaid).toBe('400.00');
    expect(firstPage.totalPaid).not.toBe(full.totalPaid);
    // The aggregate path reproduces the full-ledger numbers exactly.
    expect(
      describeCommissionBalance({ totalEarned: '2500.00', totalPaid: '900.00' }),
    ).toEqual({ totalEarned: '2500.00', totalPaid: '900.00', unpaid: '1600.00' });
  });
});

describe('describeCommissionBalance', () => {
  it('formats Prisma aggregate decimals to 2dp', () => {
    expect(
      describeCommissionBalance({
        totalEarned: { toString: () => '425.086' },
        totalPaid: { toString: () => '0' },
      }),
    ).toEqual({ totalEarned: '425.09', totalPaid: '0.00', unpaid: '425.09' });
  });

  it('handles null/undefined aggregates as zero', () => {
    expect(describeCommissionBalance({ totalEarned: null, totalPaid: undefined })).toEqual({
      totalEarned: '0.00',
      totalPaid: '0.00',
      unpaid: '0.00',
    });
  });
});
