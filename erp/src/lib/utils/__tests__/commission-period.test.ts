/**
 * ARGUS #343 — commission windows are inclusive LOCAL calendar days.
 *
 * Regression: `new Date(year, month, 1).toISOString().slice(0, 10)` produced
 * 31 Oct for 1 November in UTC+05:30, so the default report ended on 29 Nov at
 * 05:29 instead of covering the whole month.
 */
import { describe, expect, it } from 'vitest';
import {
  CommissionPeriodError,
  formatLocalDateYmd,
  resolveCommissionPeriod,
} from '@/lib/utils/commission-period';

const NOV_15_2026 = new Date(2026, 10, 15, 12, 0, 0, 0);

function expectLocalDay(date: Date, year: number, monthIndex: number, day: number) {
  expect(date.getFullYear()).toBe(year);
  expect(date.getMonth()).toBe(monthIndex);
  expect(date.getDate()).toBe(day);
}

describe('resolveCommissionPeriod', () => {
  it('defaults to the whole current local month', () => {
    const period = resolveCommissionPeriod(undefined, undefined, NOV_15_2026);
    expect(period.startDate).toBe('2026-11-01');
    expect(period.endDate).toBe('2026-11-30');
    expectLocalDay(period.periodStart, 2026, 10, 1);
    expect(period.periodStart.getHours()).toBe(0);
    expectLocalDay(period.periodEnd, 2026, 10, 30);
    expect(period.periodEnd.getHours()).toBe(23);
    expect(period.periodEnd.getMinutes()).toBe(59);
    expect(period.periodEnd.getSeconds()).toBe(59);
    expect(period.periodEnd.getMilliseconds()).toBe(999);
  });

  it('covers a 30-day month exactly once, without an off-by-one day', () => {
    const period = resolveCommissionPeriod('2026-11-01', '2026-11-30', NOV_15_2026);
    expect(period.endDate).toBe('2026-11-30');
    // Both boundaries are instants on local calendar days, not UTC slices.
    expect(formatLocalDateYmd(period.periodStart)).toBe('2026-11-01');
    expect(formatLocalDateYmd(period.periodEnd)).toBe('2026-11-30');
  });

  it('handles month lengths and leap years', () => {
    expect(resolveCommissionPeriod('2026-02-01', '2026-02-28').endDate).toBe('2026-02-28');
    expect(resolveCommissionPeriod('2028-02-01', '2028-02-29').endDate).toBe('2028-02-29');
    expect(resolveCommissionPeriod('2026-04-01', '2026-04-30').endDate).toBe('2026-04-30');
  });

  it('defaults a missing end to the end of the start month', () => {
    const period = resolveCommissionPeriod('2026-02-10', undefined, NOV_15_2026);
    expect(period.startDate).toBe('2026-02-10');
    expect(period.endDate).toBe('2026-02-28');
  });

  it('defaults a missing start to the first of the end month', () => {
    const period = resolveCommissionPeriod(undefined, '2026-12-20', NOV_15_2026);
    expect(period.startDate).toBe('2026-12-01');
    expect(period.endDate).toBe('2026-12-20');
  });

  it('passes ISO instants through unchanged (UTC server cannot shift them)', () => {
    const start = new Date(2026, 10, 1, 0, 0, 0, 0).toISOString();
    const end = new Date(2026, 10, 30, 23, 59, 59, 999).toISOString();
    const period = resolveCommissionPeriod(start, end, NOV_15_2026);
    expect(period.periodStart.toISOString()).toBe(start);
    expect(period.periodEnd.toISOString()).toBe(end);
    expect(period.startIso).toBe(start);
    expect(period.endIso).toBe(end);
  });

  it('rejects malformed and inverted windows', () => {
    expect(() => resolveCommissionPeriod('2026-02-31', '2026-03-01')).toThrow(CommissionPeriodError);
    expect(() => resolveCommissionPeriod('11-2026', '2026-12-01')).toThrow(CommissionPeriodError);
    expect(() => resolveCommissionPeriod('2026-12-01', '2026-11-30')).toThrow(CommissionPeriodError);
  });
});
