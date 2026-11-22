/**
 * ARGUS #200 - one timestamp format for the Movement History page and CSV.
 *
 * The API stores instants in UTC and the page renders them in the viewer's
 * local zone. The CSV used `toISOString()`, so `15 Nov 11:07 pm` in the UI could
 * appear as `17:37Z` and even fall on the previous calendar day. Both surfaces
 * now use this formatter with the store timezone, and the CSV keeps a separate
 * UTC column for machine-readable traceability.
 */

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
};

const TIME_OPTIONS: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
};

/** A configured IANA zone, or the server's local zone / UTC fallback. */
export function stockMovementDisplayTimeZone(configured?: string | null): string {
  if (configured && isValidTimeZone(configured)) return configured;
  const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return resolved && isValidTimeZone(resolved) ? resolved : 'UTC';
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/**
 * Format like the Movement History table: `15 Nov 2026, 11:07 pm`.
 * Invalid input returns an empty string rather than "Invalid Date".
 */
export function formatStockMovementTimestamp(
  value: string | Date,
  timeZone?: string | null,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const zone = timeZone ? { timeZone } : {};
  const day = date.toLocaleDateString('en-GB', { ...DATE_OPTIONS, ...zone });
  const time = date.toLocaleTimeString('en-GB', { ...TIME_OPTIONS, ...zone });
  return `${day}, ${time}`;
}
