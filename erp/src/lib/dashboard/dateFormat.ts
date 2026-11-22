/**
 * ARGUS #44 - one date/time style for the whole dashboard.
 *
 * The page used to mix `11:06 PM`, `15 Nov 23:07` and `Fri, Nov 13`. Every
 * dashboard date now uses the same day-first, 24-hour format:
 *
 * - timestamp: `15 Nov 2026, 23:07`
 * - chart day: `13 Nov`
 *
 * The year is kept in timestamps so a stale stock movement cannot be mistaken
 * for one from the current year.
 */

const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const DAY_MONTH = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
});

export function formatDashboardDateTime(
  value: Date | string | null | undefined,
): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return DATE_TIME.format(date);
}

/**
 * Label for a local calendar key (`YYYY-MM-DD`). Parse the parts directly so a
 * timezone behind UTC cannot shift the label to the previous day.
 */
export function formatDashboardDay(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return dateKey;
  return DAY_MONTH.format(new Date(year, month - 1, day));
}
