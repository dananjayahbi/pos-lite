import { describe, expect, it } from 'vitest';

import {
  bucketStartUtc,
  buildRevenueSeries,
  pickAxisTicks,
  type RevenueApiPoint,
} from '../revenue-trend';

const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString();

function point(
  y: number,
  m: number,
  d: number,
  revenue: number | string,
  returns: number | string = 0,
  transactions = 1,
): RevenueApiPoint {
  return { date: iso(y, m, d), revenue, returns, transactions };
}

describe('bucketStartUtc', () => {
  it('floors a daily bucket to UTC midnight', () => {
    expect(new Date(bucketStartUtc(Date.UTC(2026, 10, 14, 18, 30), 'daily')).toISOString()).toBe(
      iso(2026, 11, 14),
    );
  });

  it('floors weekly buckets to the ISO Monday', () => {
    // 2026-10-16 is a Friday; its ISO week starts Monday 2026-10-12.
    expect(new Date(bucketStartUtc(Date.UTC(2026, 9, 16), 'weekly')).toISOString()).toBe(
      iso(2026, 10, 12),
    );
    // Sunday belongs to the week that started the previous Monday.
    expect(new Date(bucketStartUtc(Date.UTC(2026, 9, 18), 'weekly')).toISOString()).toBe(
      iso(2026, 10, 12),
    );
  });

  it('floors monthly buckets to the first of the month', () => {
    expect(new Date(bucketStartUtc(Date.UTC(2026, 10, 14), 'monthly')).toISOString()).toBe(
      iso(2026, 11, 1),
    );
  });
});

describe('buildRevenueSeries - daily', () => {
  it('fills every day in the range with zeros around sparse API buckets', () => {
    const series = buildRevenueSeries(
      [point(2026, 10, 17, '1000', '250'), point(2026, 10, 19, 500)],
      '2026-10-16',
      '2026-10-20',
      'daily',
    );

    expect(series).toHaveLength(5);
    expect(series.map((p) => new Date(p.timestamp).toISOString().slice(0, 10))).toEqual([
      '2026-10-16',
      '2026-10-17',
      '2026-10-18',
      '2026-10-19',
      '2026-10-20',
    ]);
    expect(series.map((p) => p.revenue)).toEqual([0, 1000, 0, 500, 0]);
    expect(series[1]?.returns).toBe(250);
    expect(series[1]?.transactions).toBe(1);
    expect(series[2]?.transactions).toBe(0);
  });

  it('keeps a returns-only bucket visible with zero revenue', () => {
    const series = buildRevenueSeries([point(2026, 10, 17, 0, 890)], '2026-10-17', '2026-10-17', 'daily');
    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({ revenue: 0, returns: 890 });
  });

  it('sums duplicate buckets and ignores points outside the range', () => {
    const series = buildRevenueSeries(
      [
        point(2026, 10, 17, 100, 10),
        point(2026, 10, 17, 50, 5),
        point(2026, 9, 1, 9999),
        point(2026, 12, 31, 9999),
      ],
      '2026-10-17',
      '2026-10-17',
      'daily',
    );

    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({ revenue: 150, returns: 15, transactions: 2 });
  });

  it('handles a one-day range and the end of a month', () => {
    const series = buildRevenueSeries([], '2026-10-31', '2026-11-02', 'daily');
    expect(series.map((p) => p.date.slice(0, 10))).toEqual([
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
    expect(series.every((p) => p.revenue === 0 && p.returns === 0)).toBe(true);
  });

  it('returns an empty series for invalid or inverted ranges', () => {
    expect(buildRevenueSeries([], null, '2026-10-20', 'daily')).toEqual([]);
    expect(buildRevenueSeries([], '2026-10-20', null, 'daily')).toEqual([]);
    expect(buildRevenueSeries([], 'not-a-date', '2026-10-20', 'daily')).toEqual([]);
    expect(buildRevenueSeries([], '2026-10-20', '2026-10-01', 'daily')).toEqual([]);
  });
});

describe('buildRevenueSeries - weekly and monthly', () => {
  it('fills every ISO week in the range', () => {
    const series = buildRevenueSeries(
      [point(2026, 10, 16, 2000)],
      '2026-10-16',
      '2026-10-28',
      'weekly',
    );

    expect(series.map((p) => p.date.slice(0, 10))).toEqual([
      '2026-10-12',
      '2026-10-19',
      '2026-10-26',
    ]);
    expect(series.map((p) => p.revenue)).toEqual([2000, 0, 0]);
  });

  it('fills every month in the range', () => {
    const series = buildRevenueSeries(
      [point(2026, 11, 14, 3000)],
      '2026-10-16',
      '2026-12-02',
      'monthly',
    );

    expect(series.map((p) => p.date.slice(0, 10))).toEqual([
      '2026-10-01',
      '2026-11-01',
      '2026-12-01',
    ]);
    expect(series.map((p) => p.revenue)).toEqual([0, 3000, 0]);
  });

  it('coerces string decimals and tolerates malformed amounts', () => {
    const series = buildRevenueSeries(
      [
        { date: iso(2026, 10, 17), revenue: '123.45', returns: '10.5', transactions: 2 },
        { date: iso(2026, 10, 17), revenue: 'nope', returns: '0', transactions: 1 },
      ],
      '2026-10-17',
      '2026-10-17',
      'daily',
    );
    expect(series[0]).toMatchObject({ revenue: 123.45, returns: 10.5, transactions: 3 });
  });
});

describe('pickAxisTicks', () => {
  it('returns evenly spaced ticks including the first and last bucket', () => {
    const series = buildRevenueSeries([], '2026-10-01', '2026-10-30', 'daily');
    const ticks = pickAxisTicks(series, 6);

    expect(ticks).toHaveLength(6);
    expect(ticks[0]).toBe(series[0]!.timestamp);
    expect(ticks[ticks.length - 1]).toBe(series[series.length - 1]!.timestamp);
    expect([...ticks].sort((a, b) => a - b)).toEqual(ticks);
  });

  it('deduplicates ticks for short series', () => {
    const series = buildRevenueSeries([], '2026-10-01', '2026-10-02', 'daily');
    expect(pickAxisTicks(series, 6)).toHaveLength(2);
  });

  it('handles a single bucket and an empty series', () => {
    const series = buildRevenueSeries([], '2026-10-01', '2026-10-01', 'daily');
    expect(pickAxisTicks(series, 6)).toEqual([series[0]!.timestamp]);
    expect(pickAxisTicks([], 6)).toEqual([]);
  });
});
