/**
 * ARGUS #40 — Recent Sales row timestamp.
 *
 * The dashboard table listed only the clock time, so rows covering two days
 * looked out of order (11:06 PM → 10:08 PM → 9:00 PM). Rows outside today now
 * carry the calendar day: "Today, …", "Yesterday, …", "15 Nov, …".
 */

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatRecentSaleTimestamp(
  value: Date | string | null | undefined,
  now: Date = new Date(),
): string {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const time = date.toLocaleTimeString('en-LK', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (sameCalendarDay(date, now)) return `Today, ${time}`;

  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameCalendarDay(date, yesterday)) return `Yesterday, ${time}`;

  const day = date.toLocaleDateString('en-LK', {
    day: 'numeric',
    month: 'short',
  });
  return `${day}, ${time}`;
}
