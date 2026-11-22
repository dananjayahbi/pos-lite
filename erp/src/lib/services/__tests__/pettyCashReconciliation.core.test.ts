import { describe, expect, it } from 'vitest';

import {
  auditLedgerTrail,
  matchTopUpAudits,
  planBalanceAfterRebuild,
  type LedgerTrailRow,
  type TopUpAuditRow,
  type TopUpLedgerRow,
} from '@/lib/services/pettyCashReconciliation.core';

/**
 * ARGUS #406 — the fund ledger's running balance must be reproducible and every
 * top-up audit must have a matching ledger debit.
 */
function ledgerRow(
  id: string,
  entryDate: string,
  debit: number,
  credit: number,
  balanceAfter: number,
): LedgerTrailRow {
  return { id, entryDate, debit, credit, balanceAfter };
}

describe('auditLedgerTrail', () => {
  it('accepts a chain where each row follows the previous actual balance', () => {
    const rows = [
      ledgerRow('a', '2026-11-01', 10125, 0, 10125),
      ledgerRow('b', '2026-11-02', 0, 1200, 8925),
      ledgerRow('c', '2026-11-03', 0, 230, 8695),
    ];
    const report = auditLedgerTrail(rows);
    expect(report.breaks).toEqual([]);
    expect(report.finalBalanceAfter).toBe('8695.00');
  });

  it('reports a row whose balanceAfter ignores the previous row', () => {
    const rows = [
      ledgerRow('a', '2026-11-01', 10125, 0, 10125),
      ledgerRow('b', '2026-11-02', 0, 45, 10080),
      ledgerRow('c', '2026-11-03', 0, 5000, 5000), // jumped by 5,000
    ];
    const report = auditLedgerTrail(rows);
    expect(report.breaks).toHaveLength(1);
    expect(report.breaks[0]).toMatchObject({
      id: 'c',
      expectedBalanceAfter: '5080.00',
      actualBalanceAfter: '5000.00',
      difference: '-80.00',
    });
  });

  it('orders by entryDate then id before walking', () => {
    const rows = [
      ledgerRow('b', '2026-11-02', 0, 50, 9950),
      ledgerRow('a', '2026-11-01', 10000, 0, 10000),
    ];
    const report = auditLedgerTrail(rows);
    expect(report.rows.map((row) => row.id)).toEqual(['a', 'b']);
    expect(report.breaks).toEqual([]);
  });

  it('anchors on the first row (the prior opening is not knowable here)', () => {
    const rows = [ledgerRow('a', '2026-11-01', 0, 500, 500)];
    expect(auditLedgerTrail(rows).breaks).toEqual([]);
  });
});

describe('planBalanceAfterRebuild', () => {
  it('recomputes the trail from the first row and reports changed rows', () => {
    const rows = [
      ledgerRow('a', '2026-11-01', 10125, 0, 10125),
      ledgerRow('b', '2026-11-02', 0, 45, 10080),
      ledgerRow('c', '2026-11-03', 0, 5000, 5000),
    ];
    const plan = planBalanceAfterRebuild(rows);
    expect(plan.updates).toEqual([
      { id: 'c', previous: '5000.00', balanceAfter: '5080.00' },
    ]);
    expect(plan.expectedFinalBalanceAfter).toBe('5080.00');
  });

  it('is a no-op for a consistent trail', () => {
    const rows = [
      ledgerRow('a', '2026-11-01', 100, 0, 100),
      ledgerRow('b', '2026-11-02', 0, 25, 75),
    ];
    expect(planBalanceAfterRebuild(rows).updates).toEqual([]);
  });
});

describe('matchTopUpAudits', () => {
  const audit = (id: string, createdAt: string, amount: number): TopUpAuditRow => ({
    id,
    createdAt,
    amount,
  });
  const entry = (id: string, entryDate: string, amount: number): TopUpLedgerRow => ({
    id,
    entryDate,
    amount,
  });

  it('matches by amount and day and consumes one entry per audit', () => {
    const result = matchTopUpAudits(
      [audit('a1', '2026-11-06T09:00:00Z', 10000), audit('a2', '2026-11-06T10:00:00Z', 10000)],
      [entry('e1', '2026-11-06', 10000)],
    );

    expect(result.matched).toEqual([{ auditId: 'a1', ledgerEntryId: 'e1' }]);
    expect(result.unmatchedAudits.map((row) => row.id)).toEqual(['a2']);
    expect(result.unmatchedLedgerEntries).toEqual([]);
  });

  it('reports a top-up audit with no matching ledger debit', () => {
    const result = matchTopUpAudits(
      [audit('a1', '2026-11-06T09:00:00Z', 10000)],
      [entry('e1', '2026-11-06', 1)],
    );
    expect(result.unmatchedAudits.map((row) => row.id)).toEqual(['a1']);
    expect(result.unmatchedLedgerEntries.map((row) => row.id)).toEqual(['e1']);
  });

  it('reports a top-up ledger debit with no audit', () => {
    const result = matchTopUpAudits([], [entry('e1', '2026-11-06', 10000)]);
    expect(result.unmatchedLedgerEntries.map((row) => row.id)).toEqual(['e1']);
  });

  it('prefers explicit ledger ids when the audit recorded them', () => {
    const result = matchTopUpAudits(
      [{ ...audit('a1', '2026-11-06T09:00:00Z', 10000), ledgerEntryIds: ['e2'] }],
      [entry('e1', '2026-11-06', 10000), entry('e2', '2026-11-04', 10000)],
    );
    expect(result.matched).toEqual([{ auditId: 'a1', ledgerEntryId: 'e2' }]);
    expect(result.unmatchedLedgerEntries.map((row) => row.id)).toEqual(['e1']);
  });

  it('uses the recorded backdated entryDate for a legacy match', () => {
    const result = matchTopUpAudits(
      [{ ...audit('a1', '2026-11-10T09:00:00Z', 10000), entryDate: '2026-11-06' }],
      [entry('e1', '2026-11-06', 10000)],
    );
    expect(result.matched).toEqual([{ auditId: 'a1', ledgerEntryId: 'e1' }]);
  });
});
