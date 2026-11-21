import { describe, expect, it } from 'vitest';

import {
  PETTY_CASH_LEDGER_LIMIT,
  buildRunningLedger,
  ledgerDisclosure,
  type PettyCashLedgerInput,
} from '@/lib/petty-cash/ledger';

function expense(id: string, date: string, amount: number): PettyCashLedgerInput {
  return { id, kind: 'expense', date, description: id, amount, recordedByEmail: 'owner@example.com' };
}

function topUp(id: string, date: string, amount: number): PettyCashLedgerInput {
  return { id, kind: 'topup', date, description: id, amount, recordedByEmail: 'manager@example.com' };
}

describe('petty-cash running ledger (ARGUS #410)', () => {
  it('starts from the live balance and walks backwards to the shown opening', () => {
    const view = buildRunningLedger(
      [expense('e1', '2026-09-01', 100), topUp('t1', '2026-09-02', 500), expense('e2', '2026-09-03', 200)],
      1200,
    );

    // Displayed net = +500 - 100 - 200 = 200; opening shown = 1000.
    expect(view.openingBalance).toBe(1000);
    expect(view.displayedNet).toBe(200);
    expect(view.currentBalance).toBe(1200);

    // Newest first, and the newest row reconciles to the live balance.
    expect(view.rows.map((row) => row.id)).toEqual(['e2', 't1', 'e1']);
    expect(view.rows[0]?.runningBalance).toBe(1200);
    expect(view.rows[1]?.runningBalance).toBe(1400);
    expect(view.rows[2]?.runningBalance).toBe(900);
  });

  it('keeps cent precision across several rows', () => {
    const view = buildRunningLedger(
      [topUp('t1', '2026-09-01', 100.1), expense('e1', '2026-09-02', 0.2)],
      1099.9,
    );
    expect(view.rows[0]?.runningBalance).toBe(1099.9);
    expect(view.rows[1]?.runningBalance).toBe(1100.1);
  });

  it('accepts string amounts from the API decimal serializer', () => {
    const view = buildRunningLedger(
      [
        { id: 'e1', kind: 'expense', date: '2026-09-01', description: 'x', amount: '125.50' },
        { id: 't1', kind: 'topup', date: '2026-09-02', description: 'y', amount: '500.00' },
      ],
      374.5,
    );
    expect(view.rows[0]?.amount).toBe(500);
    expect(view.rows[0]?.runningBalance).toBe(374.5);
    expect(view.rows[1]?.runningBalance).toBe(-125.5);
  });

  it('breaks same-day ties by createdAt, then id', () => {
    const view = buildRunningLedger(
      [
        { ...expense('b', '2026-09-01', 10), createdAt: '2026-09-01T10:00:00.000Z' },
        { ...expense('a', '2026-09-01', 5), createdAt: '2026-09-01T09:00:00.000Z' },
      ],
      100,
    );
    expect(view.rows.map((row) => row.id)).toEqual(['b', 'a']);
  });

  it('handles an empty displayed window', () => {
    const view = buildRunningLedger([], 250);
    expect(view.rows).toEqual([]);
    expect(view.openingBalance).toBe(250);
    expect(view.displayedNet).toBe(0);
    expect(view.currentBalance).toBe(250);
  });

  it('discloses truncation only when rows are hidden', () => {
    expect(PETTY_CASH_LEDGER_LIMIT).toBe(20);
    expect(ledgerDisclosure(20, 34)).toEqual({
      shown: 20,
      total: 34,
      limit: 20,
      truncated: true,
    });
    expect(ledgerDisclosure(7, 7).truncated).toBe(false);
  });
});
