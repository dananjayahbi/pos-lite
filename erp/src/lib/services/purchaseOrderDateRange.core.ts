/**
 * Inclusive local-day bounds for the purchase-order list filter (ARGUS #230).
 *
 * The list displays `PurchaseOrder.orderDate` but the filter used to compare
 * the UTC `createdAt` timestamp against `yyyy-mm-dd` strings, so an order dated
 * 29 Oct but created late on 28 Oct UTC disappeared from a 29 Oct filter.
 *
 * A `<input type="date">` yields a bare, timezone-less day. The day is expanded
 * in the server's local timezone: 00:00:00.000 for the lower bound and
 * 23:59:59.999 for the upper bound, so both edges are inclusive. Keeping this
 * pure makes the boundary arithmetic testable in any timezone.
 */

const ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real `yyyy-mm-dd` calendar day (rejects 2026-02-31 rollovers). */
export function isValidIsoDay(value: string): boolean {
  if (!ISO_DAY_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const parsed = new Date(year, month - 1, day, 0, 0, 0, 0);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

export interface PurchaseOrderDateRange {
  gte?: Date;
  lte?: Date;
}

/**
 * Build a Prisma range for the displayed order date. Returns `undefined` when
 * neither bound is supplied. An invalid day fails loudly rather than silently
 * widening the range.
 */
export function buildPurchaseOrderDateRange(
  from?: string | null,
  to?: string | null,
): PurchaseOrderDateRange | undefined {
  const range: PurchaseOrderDateRange = {};

  if (from) {
    if (!isValidIsoDay(from)) {
      throw new Error(`INVALID_DATE_RANGE: invalid from day "${from}"`);
    }
    const [year, month, day] = from.split('-').map(Number) as [number, number, number];
    range.gte = new Date(year, month - 1, day, 0, 0, 0, 0);
  }

  if (to) {
    if (!isValidIsoDay(to)) {
      throw new Error(`INVALID_DATE_RANGE: invalid to day "${to}"`);
    }
    const [year, month, day] = to.split('-').map(Number) as [number, number, number];
    range.lte = new Date(year, month - 1, day, 23, 59, 59, 999);
  }

  return range.gte === undefined && range.lte === undefined ? undefined : range;
}
