/**
 * Shift sales counts (ARGUS #110).
 *
 * The shifts list used `_count.sales` and labelled it "Sales". That relation
 * count includes OPEN (held) and VOIDED rows, so an open shift could report 56
 * sales while its closure/Z-report reported the 10 COMPLETED sales. Closures
 * void lingering OPEN rows first and then aggregate COMPLETED only, so the list
 * has to use the same definition: "Completed sales" = COMPLETED rows, and
 * "Transactions" = every row attached to the shift.
 *
 * Pure so the list, the service and the tests share one definition.
 */

export type ShiftSaleStatus = 'OPEN' | 'COMPLETED' | 'VOIDED';

export interface ShiftSalesSummary {
  /** COMPLETED sales — the figure closures and Z-reports report. */
  completed: number;
  /** VOIDED sales — transactions that never became revenue. */
  voided: number;
  /** OPEN sales — held/not settled yet (voided when the shift closes). */
  held: number;
  /** Every sale row attached to the shift (completed + voided + held). */
  total: number;
}

export interface ShiftSaleCountRow {
  shiftId: string | null;
  status: string;
  count: number;
}

export const SHIFT_SALES_LABELS = {
  transactions: 'Transactions',
  completed: 'Completed sales',
} as const;

const EMPTY: ShiftSalesSummary = { completed: 0, voided: 0, held: 0, total: 0 };

export function emptyShiftSales(): ShiftSalesSummary {
  return { ...EMPTY };
}

/** Count sale statuses into the presentation used by the shifts surfaces. */
export function summarizeShiftSales(
  statuses: Iterable<string>,
): ShiftSalesSummary {
  const summary = emptyShiftSales();
  for (const status of statuses) {
    summary.total += 1;
    if (status === 'COMPLETED') summary.completed += 1;
    else if (status === 'VOIDED') summary.voided += 1;
    else if (status === 'OPEN') summary.held += 1;
  }
  return summary;
}

/**
 * Map aggregated rows (`groupBy shiftId/status`) to per-shift summaries. Rows
 * without a shift cannot belong to a shift row and are ignored.
 */
export function groupShiftSalesByShift(
  rows: Iterable<ShiftSaleCountRow>,
): Map<string, ShiftSalesSummary> {
  const byShift = new Map<string, ShiftSalesSummary>();
  for (const row of rows) {
    if (!row.shiftId) continue;
    const summary = byShift.get(row.shiftId) ?? emptyShiftSales();
    summary.total += row.count;
    if (row.status === 'COMPLETED') summary.completed += row.count;
    else if (row.status === 'VOIDED') summary.voided += row.count;
    else if (row.status === 'OPEN') summary.held += row.count;
    byShift.set(row.shiftId, summary);
  }
  return byShift;
}

/**
 * Muted detail next to the completed count, e.g. "46 voided · 2 held". Empty
 * when every row is completed, so a clean row stays uncluttered.
 */
export function shiftSalesDetailLabel(summary: ShiftSalesSummary): string {
  const parts: string[] = [];
  if (summary.voided > 0) parts.push(`${summary.voided} voided`);
  if (summary.held > 0) parts.push(`${summary.held} held`);
  return parts.join(' · ');
}
