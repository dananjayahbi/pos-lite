/**
 * Date-range presets for the Sales history page.
 *
 * Preset filters: Today, Yesterday, This Month, Last Month, + a Custom range.
 * Dates are kept as `yyyy-mm-dd` strings (the value type used by native
 * `<input type="date">`) so the UI stays simple and timezone-safe enough for
 * a POS context. "Today" is the default.
 */

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'thisMonth'
  | 'lastMonth'
  | 'custom';

export interface DateRangeFilterValue {
  preset: DateRangePreset;
  /** Start date as `yyyy-mm-dd` (inclusive). Empty = unbounded. */
  from: string;
  /** End date as `yyyy-mm-dd` (inclusive). Empty = unbounded. */
  to: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Format a Date as a local `yyyy-mm-dd` string. */
export function toYMD(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Resolve the concrete from/to dates (as `yyyy-mm-dd`) for a non-custom
 * preset.
 */
export function computePresetRange(
  preset: Exclude<DateRangePreset, 'custom'>,
  now: Date = new Date(),
): { from: string; to: string } {
  let from: Date;
  let to: Date;

  switch (preset) {
    case 'today':
      from = now;
      to = now;
      break;
    case 'yesterday': {
      from = new Date(now);
      from.setDate(now.getDate() - 1);
      to = from;
      break;
    }
    case 'thisMonth':
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'lastMonth':
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    default:
      return { from: '', to: '' };
  }

  return { from: toYMD(from), to: toYMD(to) };
}

/**
 * Return the default filter value: "Today", which is also the initial (and
 * only) axis the Sales API filters by until the user changes it.
 */
export function defaultDateRange(): DateRangeFilterValue {
  const range = computePresetRange('today');
  return { preset: 'today', ...range };
}
