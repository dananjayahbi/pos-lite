export function formatRupee(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return 'Rs. 0.00';
  return `Rs. ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Rupee amount with a leading minus for negatives, e.g. `-Rs. 1,156.70`.
 * Keeps `formatRupee()`'s grouping and two decimals (ARGUS #57).
 */
export function formatSignedRupee(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(num)) return 'Rs. 0.00';
  return `${num < 0 ? '-' : ''}${formatRupee(Math.abs(num))}`;
}

const RUPEE_TEXT_PATTERN = /Rs\.\s*(-?)([\d,]+(?:\.\d+)?)/g;

/**
 * Normalise `Rs. 2476.58` / `Rs. -1156.70` inside stored notification text to
 * the app-wide `Rs. 2,476.58` / `-Rs. 1,156.70`. Historical bodies are never
 * rewritten in the database, so display code passes them through here.
 */
export function normalizeRupeeText(text: string): string {
  return text.replace(RUPEE_TEXT_PATTERN, (match, sign: string, amount: string) => {
    const numeric = Number.parseFloat(amount.replace(/,/g, ''));
    if (!Number.isFinite(numeric)) return match;
    return formatSignedRupee(sign === '-' ? -numeric : numeric);
  });
}

export function formatLKR(amount: number | { toNumber(): number }): string {
  const value = typeof amount === 'number' ? amount : amount.toNumber();
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
  }).format(value);
}

const LEDGER_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
};

/**
 * Day-first date used by every ledger/detail surface: `28 Oct 2026`.
 *
 * ARGUS #83: the sales list, modal and detail page each had their own
 * formatter (`28 Oct 2026`, `28 Oct 2026, 20:45`, `Oct 28, 2026, 8:45 PM`).
 * One helper keeps the accounting date identical everywhere.
 */
export function formatShortDate(value: string | Date | null | undefined): string {
  if (value === null || value === undefined) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', LEDGER_DATE_OPTIONS);
}

/** 24-hour clock time used alongside `formatShortDate`: `20:45`. */
export function formatShortTime(value: string | Date | null | undefined): string {
  if (value === null || value === undefined) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** `28 Oct 2026, 20:45`. */
export function formatShortDateTime(value: string | Date | null | undefined): string {
  if (value === null || value === undefined) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return `${formatShortDate(date)}, ${formatShortTime(date)}`;
}

/**
 * Day-first display date used across the app, e.g. `28 Oct 2026`.
 * Returns an empty string for an unparseable value so callers never render
 * `Invalid Date`.
 */
export function formatDisplayDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format a date relative to "now" for quick recency reading, e.g. "2 days ago",
 * "3 weeks ago", or an absolute date for older values. Returns null for null input.
 */
export function formatRelativeDate(value: string | Date | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 0) return 'in the future';

  const intervals: { label: string; seconds: number }[] = [
    { label: 'year', seconds: 31_536_000 },
    { label: 'month', seconds: 2_592_000 },
    { label: 'week', seconds: 604_800 },
    { label: 'day', seconds: 86_400 },
    { label: 'hour', seconds: 3_600 },
    { label: 'minute', seconds: 60 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) {
      return `${count} ${interval.label}${count === 1 ? '' : 's'} ago`;
    }
  }
  return 'just now';
}
