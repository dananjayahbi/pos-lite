/**
 * Ledger source display/filter classification (ARGUS #430).
 *
 * The enum only has `SALE_REFUND`, but that source is reused for:
 * - a return refund (sourceId = return id);
 * - a cancelled-return reversal (`return-cancel:` prefix);
 * - a void/full-sale reversal (sourceId = sale id).
 *
 * Grouping by enum alone labelled 59 void reversals as "Sale Refund", so a
 * Sale Refund filter returned voids instead of returns. The pseudo source
 * `SALE_VOID` separates them using the originating document id.
 */
import Decimal from 'decimal.js';

export const SALE_VOID_SOURCE = 'SALE_VOID' as const;

export interface RefundSourceIds {
  returnIds: ReadonlySet<string>;
  saleIds: ReadonlySet<string>;
}

/**
 * Resolve the display/filter source for a ledger row. Non-refund sources pass
 * through unchanged; SALE_REFUND rows tied to a sale become SALE_VOID.
 */
export function classifyLedgerSource(
  source: string,
  sourceId: string | null | undefined,
  ids: RefundSourceIds,
): string {
  if (source !== 'SALE_REFUND') return source;
  if (sourceId && ids.saleIds.has(sourceId)) return SALE_VOID_SOURCE;
  return 'SALE_REFUND';
}

/** True when a row should be returned for the selected source filter. */
export function matchesLedgerSourceFilter(
  source: string,
  sourceId: string | null | undefined,
  filter: string | null | undefined,
  ids: RefundSourceIds,
): boolean {
  if (!filter) return true;
  if (filter === SALE_VOID_SOURCE) {
    return classifyLedgerSource(source, sourceId, ids) === SALE_VOID_SOURCE;
  }
  if (filter === 'SALE_REFUND') {
    return classifyLedgerSource(source, sourceId, ids) === 'SALE_REFUND';
  }
  return source === filter;
}

/**
 * Next cached account balance for a ledger line (ARGUS #434). Kept pure and
 * shared with the service so the debit-increases / credit-decreases rule has
 * an explicit, testable contract instead of living only inside a transaction.
 */
export function nextAccountBalance(
  current: Decimal.Value,
  debit: Decimal.Value,
  credit: Decimal.Value,
): Decimal {
  return new Decimal(current).plus(debit).minus(credit);
}

/** Page count for the account book / tenant ledger (ARGUS #434). */
export function ledgerTotalPages(total: number, pageSize: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  if (!Number.isFinite(pageSize) || pageSize <= 0) return 0;
  return Math.ceil(total / pageSize);
}
