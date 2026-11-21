import { describe, expect, it } from 'vitest';
import type { QueryClient } from '@tanstack/react-query';
import {
  FACTORY_REFRESH_INTERVAL_MS,
  formatFactoryLastUpdated,
  isFactoryRefreshDue,
  latestUpdatedAt,
  refetchFactoryDashboard,
} from '@/lib/factory/factoryRefresh';

describe('factoryRefresh - latestUpdatedAt', () => {
  it('returns null when nothing has a usable timestamp', () => {
    expect(latestUpdatedAt([])).toBeNull();
    expect(latestUpdatedAt([null, undefined, 0, -5, Number.NaN])).toBeNull();
  });

  it('returns the newest timestamp', () => {
    expect(latestUpdatedAt([1_000, null, 3_000, 2_000])).toBe(3_000);
  });
});

describe('factoryRefresh - formatFactoryLastUpdated', () => {
  const now = new Date('2026-11-22T10:00:00.000Z').getTime();

  it('says not yet before the first update', () => {
    expect(formatFactoryLastUpdated(null, now)).toBe('not yet');
    expect(formatFactoryLastUpdated(0, now)).toBe('not yet');
  });

  it('calls the first minute just now', () => {
    expect(formatFactoryLastUpdated(now - 1_000, now)).toBe('just now');
    expect(formatFactoryLastUpdated(now - 59_000, now)).toBe('just now');
  });

  it('formats minutes, hours and days', () => {
    expect(formatFactoryLastUpdated(now - 60_000, now)).toBe('1 min ago');
    expect(formatFactoryLastUpdated(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(formatFactoryLastUpdated(now - 2 * 3_600_000, now)).toBe('2 h ago');
    expect(formatFactoryLastUpdated(now - 3 * 86_400_000, now)).toBe('3 d ago');
  });

  it('never returns a negative age when the clock moves backwards', () => {
    expect(formatFactoryLastUpdated(now + 5_000, now)).toBe('just now');
  });
});

describe('factoryRefresh - isFactoryRefreshDue', () => {
  const base = {
    now: 100_000,
    lastRunAt: 100_000 - FACTORY_REFRESH_INTERVAL_MS,
    isVisible: true,
    isRefreshing: false,
  };

  it('is due once the interval has elapsed', () => {
    expect(isFactoryRefreshDue(base)).toBe(true);
  });

  it('is not due before the interval', () => {
    expect(isFactoryRefreshDue({ ...base, now: base.now - 1 })).toBe(false);
  });

  it('is not due while a refresh is in flight', () => {
    expect(isFactoryRefreshDue({ ...base, isRefreshing: true })).toBe(false);
  });

  it('is not due in a hidden tab', () => {
    expect(isFactoryRefreshDue({ ...base, isVisible: false })).toBe(false);
  });

  it('is not due before the first run timestamp is set', () => {
    expect(isFactoryRefreshDue({ ...base, lastRunAt: null })).toBe(false);
  });

  it('honours a custom interval', () => {
    expect(
      isFactoryRefreshDue({ ...base, now: base.lastRunAt! + 5_000, intervalMs: 5_000 }),
    ).toBe(true);
  });
});

describe('factoryRefresh - refetchFactoryDashboard', () => {
  it('refetches each active dashboard key once', async () => {
    const seen: unknown[] = [];
    const fakeClient = {
      refetchQueries: async (options: { queryKey: readonly string[]; type: string }) => {
        seen.push(options);
      },
    } as unknown as QueryClient;

    await refetchFactoryDashboard(fakeClient);

    expect(seen).toEqual([
      { queryKey: ['raw-material-stats'], type: 'active' },
      { queryKey: ['raw-materials'], type: 'active' },
      { queryKey: ['raw-material-alerts'], type: 'active' },
      { queryKey: ['production-logs'], type: 'active' },
    ]);
  });
});
