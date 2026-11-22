import type { QueryClient } from '@tanstack/react-query';
import { FACTORY_DASHBOARD_QUERY_KEYS } from '@/lib/factory/factoryQueries';

/**
 * ARGUS #257 - the Factory Dashboard never refreshed itself. Its feeds
 * cache for 20-30s, so a screen left open could show hours-old stock. A
 * periodic refresh (aligned with the cache), a manual Refresh button and a
 * visible last-updated stamp keep it current without stealing focus or
 * blocking the page.
 */
export const FACTORY_REFRESH_INTERVAL_MS = 60_000;

/** How often the dashboard re-checks whether a refresh is due / ages its stamp. */
export const FACTORY_REFRESH_TICK_MS = 15_000;

/**
 * Latest real update timestamp among the values, ignoring missing/zero/invalid
 * entries. Returns null when nothing has updated yet.
 */
export function latestUpdatedAt(
  values: ReadonlyArray<number | null | undefined>,
): number | null {
  let latest: number | null = null;
  for (const value of values) {
    if (value == null || !Number.isFinite(value) || value <= 0) continue;
    if (latest === null || value > latest) latest = value;
  }
  return latest;
}

/** Human age for the last-updated stamp. Plain hyphens only. */
export function formatFactoryLastUpdated(
  lastUpdatedAt: number | null,
  now: number,
): string {
  if (lastUpdatedAt == null || !Number.isFinite(lastUpdatedAt) || lastUpdatedAt <= 0) {
    return 'not yet';
  }
  const diff = Math.max(0, now - lastUpdatedAt);
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return `${Math.floor(diff / 86_400_000)} d ago`;
}

export interface FactoryRefreshDueInput {
  now: number;
  /** When the last refresh started; null before the dashboard's first tick. */
  lastRunAt: number | null;
  isVisible: boolean;
  isRefreshing: boolean;
  intervalMs?: number;
}

/**
 * True when an automatic refresh should start. Hidden tabs and in-flight
 * refreshes are skipped, so timers never stack or hammer the API in the
 * background.
 */
export function isFactoryRefreshDue(input: FactoryRefreshDueInput): boolean {
  if (!input.isVisible) return false;
  if (input.isRefreshing) return false;
  if (input.lastRunAt === null || !Number.isFinite(input.lastRunAt)) return false;
  const interval = input.intervalMs ?? FACTORY_REFRESH_INTERVAL_MS;
  return input.now - input.lastRunAt >= interval;
}

/**
 * Refetch every active Factory Dashboard query. The queries keep their current
 * data while fetching, so the page stays usable during a refresh.
 */
export async function refetchFactoryDashboard(queryClient: QueryClient): Promise<void> {
  await Promise.all(
    FACTORY_DASHBOARD_QUERY_KEYS.map((queryKey) =>
      queryClient.refetchQueries({ queryKey, type: 'active' }),
    ),
  );
}
