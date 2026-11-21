/**
 * ARGUS #410 - the Linked Expenses table used to show at most 20 expenses and
 * 50 top-ups with no indication. The balance equation totalled every row, so
 * the visible list could not be reconciled against the headline figures.
 *
 * This pure helper merges the two truncated lists, computes a running balance
 * that ends at the live current balance, and exposes the "latest N of total"
 * disclosure data. The callers keep the balance equation on full totals.
 */
export const PETTY_CASH_LEDGER_LIMIT = 20;

export type PettyCashLedgerKind = 'expense' | 'topup';

export interface PettyCashLedgerInput {
  id: string;
  kind: PettyCashLedgerKind;
  date: string;
  createdAt?: string | null | undefined;
  description: string;
  amount: number | string;
  recordedByEmail?: string | null | undefined;
  category?: string | null | undefined;
  receiptImageUrl?: string | null | undefined;
}

export interface PettyCashLedgerRow extends PettyCashLedgerInput {
  amount: number;
  runningBalance: number;
}

export interface PettyCashLedgerView {
  /** Newest first, each row carrying the balance after that transaction. */
  rows: PettyCashLedgerRow[];
  /** Balance immediately before the oldest displayed row. */
  openingBalance: number;
  /** Net movement of the displayed rows (top-ups minus expenses). */
  displayedNet: number;
  /** The live balance the running column ends at. */
  currentBalance: number;
}

function toAmount(value: number | string): number {
  return typeof value === 'number' ? value : Number(value);
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function when(row: PettyCashLedgerInput): number {
  const primary = new Date(row.date).getTime();
  const tieBreak = row.createdAt ? new Date(row.createdAt).getTime() : primary;
  return Number.isNaN(tieBreak) ? primary : tieBreak;
}

export function buildRunningLedger(
  entries: readonly PettyCashLedgerInput[],
  currentBalance: number,
): PettyCashLedgerView {
  const ascending = [...entries].sort((a, b) => {
    const delta = when(a) - when(b);
    return delta !== 0 ? delta : a.id.localeCompare(b.id);
  });

  const displayedNet = round2(
    ascending.reduce(
      (sum, row) => sum + (row.kind === 'topup' ? toAmount(row.amount) : -toAmount(row.amount)),
      0,
    ),
  );
  const openingBalance = round2(currentBalance - displayedNet);

  let running = openingBalance;
  const rows = ascending.map((row) => {
    running = round2(
      running + (row.kind === 'topup' ? toAmount(row.amount) : -toAmount(row.amount)),
    );
    return {
      ...row,
      amount: round2(toAmount(row.amount)),
      runningBalance: running,
    };
  });

  return {
    rows: rows.reverse(),
    openingBalance,
    displayedNet,
    currentBalance: round2(currentBalance),
  };
}

export interface LedgerDisclosure {
  shown: number;
  total: number;
  limit: number;
  truncated: boolean;
}

export function ledgerDisclosure(
  shown: number,
  total: number,
  limit: number = PETTY_CASH_LEDGER_LIMIT,
): LedgerDisclosure {
  return {
    shown,
    total,
    limit,
    truncated: total > shown,
  };
}
