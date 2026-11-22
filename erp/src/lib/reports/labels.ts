/**
 * Report label vocabulary (ARGUS #440).
 *
 * Report pages used to print enum values straight into headings and tables:
 * expense categories rendered as `MISCELLANEOUS` or, after a naive lowercase,
 * as `Tea_sugar`. One helper keeps the sentence case used by the rest of the
 * app's detail surfaces.
 */

/** `MISCELLANEOUS` → `Miscellaneous`, `TEA_SUGAR` → `Tea sugar`. */
export function expenseCategoryLabel(category: string | null | undefined): string {
  if (!category) return 'Uncategorised';
  const words = category
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  if (words === '') return 'Uncategorised';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Day-first range label shared by the report header, the saved-report metadata
 * and the PDF sub-header: `1 Sep 2026 - 30 Sep 2026` (ARGUS #440).
 *
 * Month names are built from a fixed table rather than `Intl`: recent ICU data
 * abbreviates September as `Sept` in en-GB, so the same range rendered
 * differently depending on the runtime. The table keeps the app's `28 Oct 2026`
 * convention stable.
 */
const SHORT_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

function formatDatePart(ymd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return ymd;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const monthName = SHORT_MONTHS[month - 1];
  if (!monthName) return ymd;
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return ymd;
  }
  return `${day} ${monthName} ${year}`;
}

export function formatReportDateRange(from: string, to: string): string {
  return `${formatDatePart(from)} - ${formatDatePart(to)}`;
}

/** `2026-11` → `Nov 26`, the monthly-table heading. */
export function reportMonthLabel(ym: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!match) return ym;
  const year = Number(match[1]);
  const monthName = SHORT_MONTHS[Number(match[2]) - 1];
  if (!monthName) return ym;
  return `${monthName} ${String(year).slice(-2)}`;
}

/** `PAYMENT_GATEWAY` → `Payment gateway` (cash-flow account type column). */
export function accountTypeLabel(accountType: string | null | undefined): string {
  return expenseCategoryLabel(accountType?.replace(/_/g, ' ') ?? '');
}

/** `ACTIVE` / `CLOSED` badge text; other values stay readable. */
export function accountStatusLabel(status: string | null | undefined): string {
  if (!status) return '-';
  const upper = status.toUpperCase();
  if (upper === 'ACTIVE') return 'Active';
  if (upper === 'CLOSED') return 'Closed';
  return expenseCategoryLabel(status);
}

/**
 * Share of a total as a percentage (ARGUS #423). Bars scale to the total, so a
 * category at 68.3% of expenses fills 68.3% rather than 100% of the largest bar.
 */
export function shareOfTotalPercent(
  value: number | string,
  total: number | string,
): number {
  const amount = typeof value === 'number' ? value : Number.parseFloat(value);
  const whole = typeof total === 'number' ? total : Number.parseFloat(total);
  if (!Number.isFinite(amount) || !Number.isFinite(whole) || whole <= 0) return 0;
  return (amount / whole) * 100;
}
