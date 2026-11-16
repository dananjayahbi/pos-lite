/**
 * Pure helpers for the Revenue Trend report chart.
 *
 * The API only returns buckets that have sales or returns, so a 30-day range
 * with activity on four days used to reach the chart as four points. Plotted
 * with equal spacing that drew long straight lines across days with no data and
 * an x-axis whose gaps did not match the calendar (the "malformed" chart).
 * `buildRevenueSeries` fills every bucket in the requested range with zeros so
 * the line maps one-to-one onto the axis.
 */

export type RevenueGranularity = 'daily' | 'weekly' | 'monthly';

export interface RevenueApiPoint {
  date: string;
  revenue: string | number;
  returns: string | number;
  transactions: number;
}

export interface RevenueSeriesPoint {
  /** Bucket start as a UTC epoch (ms) — used for a true time axis. */
  timestamp: number;
  /** Bucket start ISO string, kept for exports and tooltips. */
  date: string;
  revenue: number;
  returns: number;
  transactions: number;
}

const DAY_MS = 86_400_000;
/** Guards against a malformed range generating an unbounded bucket list. */
const MAX_BUCKETS = 2_000;

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseYmd(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  }
  const [, y, m, d] = match;
  return Date.UTC(Number(y), Number(m) - 1, Number(d));
}

/** Start of the bucket that contains `timestamp`, in UTC (matches DATE_TRUNC). */
export function bucketStartUtc(timestamp: number, granularity: RevenueGranularity): number {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  if (granularity === 'monthly') {
    return Date.UTC(year, month, 1);
  }
  if (granularity === 'weekly') {
    // DATE_TRUNC('week') is ISO-week Monday.
    const weekday = (date.getUTCDay() + 6) % 7;
    return Date.UTC(year, month, day - weekday);
  }
  return Date.UTC(year, month, day);
}

function nextBucket(timestamp: number, granularity: RevenueGranularity): number {
  if (granularity === 'monthly') {
    const date = new Date(timestamp);
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  }
  if (granularity === 'weekly') {
    return timestamp + 7 * DAY_MS;
  }
  return timestamp + DAY_MS;
}

/**
 * Merge API buckets into a continuous series from `from` to `to`, inclusive.
 * Empty buckets are inserted with zero revenue/returns. Values for duplicate
 * buckets are summed, and points outside the requested range are ignored.
 */
export function buildRevenueSeries(
  points: readonly RevenueApiPoint[],
  from: string | null | undefined,
  to: string | null | undefined,
  granularity: RevenueGranularity,
): RevenueSeriesPoint[] {
  const fromMs = parseYmd(from);
  const toMs = parseYmd(to);
  if (fromMs === null || toMs === null || fromMs > toMs) return [];

  const first = bucketStartUtc(fromMs, granularity);
  const last = bucketStartUtc(toMs, granularity);

  const byBucket = new Map<number, RevenueSeriesPoint>();
  for (const point of points) {
    const parsed = new Date(point.date);
    if (Number.isNaN(parsed.getTime())) continue;
    const timestamp = bucketStartUtc(parsed.getTime(), granularity);
    if (timestamp < first || timestamp > last) continue;

    const existing = byBucket.get(timestamp);
    if (existing) {
      existing.revenue += toNumber(point.revenue);
      existing.returns += toNumber(point.returns);
      existing.transactions += point.transactions ?? 0;
    } else {
      byBucket.set(timestamp, {
        timestamp,
        date: new Date(timestamp).toISOString(),
        revenue: toNumber(point.revenue),
        returns: toNumber(point.returns),
        transactions: point.transactions ?? 0,
      });
    }
  }

  const series: RevenueSeriesPoint[] = [];
  for (
    let cursor = first, guard = 0;
    cursor <= last && guard < MAX_BUCKETS;
    cursor = nextBucket(cursor, granularity), guard += 1
  ) {
    const existing = byBucket.get(cursor);
    series.push(
      existing ?? {
        timestamp: cursor,
        date: new Date(cursor).toISOString(),
        revenue: 0,
        returns: 0,
        transactions: 0,
      },
    );
  }

  return series;
}

/** Evenly spaced tick timestamps (at most `maxTicks`) across the series. */
export function pickAxisTicks(
  series: readonly RevenueSeriesPoint[],
  maxTicks = 6,
): number[] {
  if (series.length === 0) return [];
  const count = Math.min(Math.max(maxTicks, 2), series.length);
  if (series.length === 1) return [series[0]!.timestamp];

  const ticks: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const index = Math.round((i * (series.length - 1)) / (count - 1));
    const timestamp = series[index]!.timestamp;
    if (ticks[ticks.length - 1] !== timestamp) ticks.push(timestamp);
  }
  return ticks;
}
