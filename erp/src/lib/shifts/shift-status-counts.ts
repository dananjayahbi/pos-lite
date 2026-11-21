/**
 * ARGUS #116: the shift ledger's "Visible open/closed shifts" cards must count
 * the whole filtered result set, not just the 20 rows on the current page.
 */

export interface ShiftStatusCounts {
  open: number;
  closed: number;
}

export interface ShiftStatusCountRow {
  status: string;
  count: number;
}

export const EMPTY_SHIFT_STATUS_COUNTS: ShiftStatusCounts = { open: 0, closed: 0 };

/** Fold a status groupBy result into the two counters the page renders. */
export function toShiftStatusCounts(
  rows: readonly ShiftStatusCountRow[] | null | undefined,
): ShiftStatusCounts {
  const counts: ShiftStatusCounts = { ...EMPTY_SHIFT_STATUS_COUNTS };
  for (const row of rows ?? []) {
    if (row.status === 'OPEN') counts.open += row.count;
    else if (row.status === 'CLOSED') counts.closed += row.count;
  }
  return counts;
}
