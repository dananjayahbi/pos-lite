import { formatDashboardDateTime } from '@/lib/dashboard/dateFormat';

/**
 * ARGUS #40 / #44 - Recent Sales row timestamp.
 *
 * ARGUS #40 required the calendar day on rows outside today; ARGUS #44 then
 * unified every dashboard timestamp on the shared day-first, 24-hour style, so
 * this is now a thin alias of `formatDashboardDateTime()`:
 * `15 Nov 2026, 23:07`.
 */
export function formatRecentSaleTimestamp(
  value: Date | string | null | undefined,
  _now: Date = new Date(),
): string {
  return formatDashboardDateTime(value);
}
