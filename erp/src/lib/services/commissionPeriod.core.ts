/**
 * Commission reporting period rules.
 *
 * A payout's `paidAt` is when the money left, not the commission month it
 * settles. Payout history for a selected commission window must therefore
 * match the payout's `periodStart`/`periodEnd` window, not `paidAt`
 * (ARGUS #362).
 */

type Dateish = Date | string | null | undefined;

export interface CommissionPeriodWindow {
  periodStart: Date;
  periodEnd: Date;
}

export interface CommissionPeriodFilter {
  periodStart?: Date | null | undefined;
  periodEnd?: Date | null | undefined;
}

function toTime(value: Dateish): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isNaN(time) ? null : time;
}

/**
 * True when the payout's commission window overlaps the selected window.
 *
 * Overlap (rather than containment) keeps a payout that spans a month boundary
 * visible in both months, while a September commission paid in November still
 * appears in September because its `periodStart/periodEnd` are September.
 */
export function payoutOverlapsCommissionPeriod(
  payout: CommissionPeriodWindow,
  filter: CommissionPeriodFilter,
): boolean {
  const payoutStart = toTime(payout.periodStart);
  const payoutEnd = toTime(payout.periodEnd);
  if (payoutStart === null || payoutEnd === null) return false;

  const filterStart = toTime(filter.periodStart);
  const filterEnd = toTime(filter.periodEnd);

  if (filterStart !== null && payoutEnd < filterStart) return false;
  if (filterEnd !== null && payoutStart > filterEnd) return false;
  return true;
}

/**
 * Effective accounting date of a sale: the explicitly entered `saleDate` for a
 * backdated/missed sale, falling back to `createdAt` for rows recorded before
 * the column existed. Commission periods follow this date (ARGUS #365).
 */
export function effectiveSaleDate(input: {
  saleDate?: Dateish;
  createdAt: Dateish;
}): Date | null {
  const saleDate = toTime(input.saleDate);
  if (saleDate !== null) return new Date(saleDate);
  const createdAt = toTime(input.createdAt);
  return createdAt === null ? null : new Date(createdAt);
}

/** Inclusive comparison against a selected commission window. */
export function isWithinCommissionPeriod(
  date: Date | null | undefined,
  filter: CommissionPeriodFilter,
): boolean {
  const time = toTime(date);
  if (time === null) return false;
  const start = toTime(filter.periodStart);
  const end = toTime(filter.periodEnd);
  if (start !== null && time < start) return false;
  if (end !== null && time > end) return false;
  return true;
}
