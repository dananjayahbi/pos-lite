import Decimal from 'decimal.js';

/**
 * ARGUS #406 — petty-cash ledger / top-up reconciliation.
 *
 * Pure helpers shared by the audit CLI and its tests:
 * - walk the fund account's entries in date/id order and report
 *   `balanceAfter` breaks (expected = previous actual + debit − credit);
 * - match top-up audits to the fund account's top-up debits (explicit ledger
 *   ids when the audit recorded them, otherwise amount + day), reporting both
 *   sides that have no partner;
 * - plan a balanceAfter rebuild without touching debits/credits.
 */

type Decimalish = Decimal | { toString(): string } | number | string | null | undefined;

export interface LedgerTrailRow {
  id: string;
  entryDate: string | Date;
  createdAt?: string | Date | null;
  debit: Decimalish;
  credit: Decimalish;
  balanceAfter: Decimalish;
  source?: string | null;
  description?: string | null;
}

export interface LedgerTrailBreak {
  id: string;
  index: number;
  expectedBalanceAfter: string;
  actualBalanceAfter: string;
  difference: string;
}

export interface LedgerTrailAudit {
  rows: LedgerTrailRow[];
  breaks: LedgerTrailBreak[];
  finalBalanceAfter: string;
}

export interface BalanceAfterUpdate {
  id: string;
  previous: string;
  balanceAfter: string;
}

export interface BalanceAfterRebuildPlan {
  updates: BalanceAfterUpdate[];
  expectedFinalBalanceAfter: string;
}

function toDecimal(value: Decimalish): Decimal {
  if (value === null || value === undefined) return new Decimal(0);
  try {
    return new Decimal(value.toString());
  } catch {
    return new Decimal(0);
  }
}

function round2(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

function time(value: string | Date | null | undefined): number {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function dayKey(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function orderRows(rows: readonly LedgerTrailRow[]): LedgerTrailRow[] {
  return [...rows].sort(
    (a, b) =>
      time(a.entryDate) - time(b.entryDate) ||
      time(a.createdAt ?? a.entryDate) - time(b.createdAt ?? b.entryDate) ||
      a.id.localeCompare(b.id),
  );
}

/** Walk the trail; the first row's actual balanceAfter is the anchor. */
export function auditLedgerTrail(rows: readonly LedgerTrailRow[]): LedgerTrailAudit {
  const ordered = orderRows(rows);
  const breaks: LedgerTrailBreak[] = [];

  if (ordered.length === 0) {
    return { rows: ordered, breaks, finalBalanceAfter: '0.00' };
  }

  let previousActual = toDecimal(ordered[0]!.balanceAfter);
  for (let index = 1; index < ordered.length; index++) {
    const row = ordered[index]!;
    const expected = round2(previousActual.plus(toDecimal(row.debit)).minus(toDecimal(row.credit)));
    const actual = round2(toDecimal(row.balanceAfter));
    const difference = round2(actual.minus(expected));

    if (!difference.abs().lessThanOrEqualTo(0.005)) {
      breaks.push({
        id: row.id,
        index,
        expectedBalanceAfter: expected.toFixed(2),
        actualBalanceAfter: actual.toFixed(2),
        difference: difference.toFixed(2),
      });
    }

    // Chain from what the row actually says (the task's rule); the break tells
    // the operator where the trail stops being reproducible.
    previousActual = actual;
  }

  return {
    rows: ordered,
    breaks,
    finalBalanceAfter: round2(previousActual).toFixed(2),
  };
}

/**
 * Rebuild every balanceAfter from the first row's implied opening balance.
 * Debits/credits and the first row's balanceAfter are left untouched.
 */
export function planBalanceAfterRebuild(
  rows: readonly LedgerTrailRow[],
): BalanceAfterRebuildPlan {
  const ordered = orderRows(rows);
  if (ordered.length === 0) {
    return { updates: [], expectedFinalBalanceAfter: '0.00' };
  }

  const first = ordered[0]!;
  let running = toDecimal(first.balanceAfter)
    .minus(toDecimal(first.debit))
    .plus(toDecimal(first.credit));

  const updates: BalanceAfterUpdate[] = [];
  for (const row of ordered) {
    running = round2(running.plus(toDecimal(row.debit)).minus(toDecimal(row.credit)));
    const previous = round2(toDecimal(row.balanceAfter));
    if (!previous.equals(running)) {
      updates.push({
        id: row.id,
        previous: previous.toFixed(2),
        balanceAfter: running.toFixed(2),
      });
    }
  }

  return {
    updates,
    expectedFinalBalanceAfter: round2(running).toFixed(2),
  };
}

export interface TopUpAuditRow {
  id: string;
  createdAt: string | Date;
  /** Audit `after.entryDate` when recorded; legacy audits fall back to createdAt. */
  entryDate?: string | Date | null;
  amount: Decimalish;
  description?: string | null;
  /** New top-ups record the ledger entry ids so matches are exact. */
  ledgerEntryIds?: string[] | null;
}

export interface TopUpLedgerRow {
  id: string;
  entryDate: string | Date;
  amount: Decimalish;
  description?: string | null;
}

function sameAmount(a: Decimalish, b: Decimalish): boolean {
  return toDecimal(a).minus(toDecimal(b)).abs().lessThanOrEqualTo(0.005);
}

/**
 * Match one ledger debit to each top-up audit. Explicit ids win (new audits);
 * legacy audits match by amount + UTC day. Each ledger row is consumed once, so
 * duplicate same-day top-ups still pair one-to-one.
 */
export function matchTopUpAudits<
  T extends TopUpAuditRow,
  E extends TopUpLedgerRow,
>(
  audits: readonly T[],
  ledgerEntries: readonly E[],
): {
  matched: Array<{ auditId: string; ledgerEntryId: string }>;
  unmatchedAudits: T[];
  unmatchedLedgerEntries: E[];
} {
  const unused = new Map(ledgerEntries.map((entry) => [entry.id, entry]));
  const matched: Array<{ auditId: string; ledgerEntryId: string }> = [];
  const unmatchedAudits: T[] = [];

  const orderedAudits = [...audits].sort(
    (a, b) => time(a.createdAt) - time(b.createdAt) || a.id.localeCompare(b.id),
  );

  for (const audit of orderedAudits) {
    const explicit = (audit.ledgerEntryIds ?? []).find((id) => unused.has(id));
    if (explicit) {
      unused.delete(explicit);
      matched.push({ auditId: audit.id, ledgerEntryId: explicit });
      continue;
    }

    const auditDate = dayKey(audit.entryDate ?? audit.createdAt);
    const candidate = [...unused.values()]
      .filter((entry) => sameAmount(entry.amount, audit.amount))
      .filter((entry) => auditDate === '' || dayKey(entry.entryDate) === auditDate)
      .sort(
        (a, b) => time(a.entryDate) - time(b.entryDate) || a.id.localeCompare(b.id),
      )[0];

    if (!candidate) {
      unmatchedAudits.push(audit);
      continue;
    }

    unused.delete(candidate.id);
    matched.push({ auditId: audit.id, ledgerEntryId: candidate.id });
  }

  return {
    matched,
    unmatchedAudits,
    unmatchedLedgerEntries: [...unused.values()].sort(
      (a, b) => time(a.entryDate) - time(b.entryDate) || a.id.localeCompare(b.id),
    ),
  };
}
