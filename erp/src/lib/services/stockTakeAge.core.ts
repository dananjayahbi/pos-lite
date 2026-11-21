/**
 * Stock-take ageing (ARGUS #147).
 *
 * An unfinished session that nobody resolves blocks new counts. Surface it as
 * stale after a grace period; nothing is auto-cancelled - a supervisor decides.
 */
export const STALE_STOCK_TAKE_DAYS = 7;

export function isStaleStockTake(
  startedAt: Date | string,
  status: string,
  now: Date = new Date(),
  staleAfterDays: number = STALE_STOCK_TAKE_DAYS,
): boolean {
  if (status !== 'IN_PROGRESS' && status !== 'PENDING_APPROVAL') return false;
  const started = new Date(startedAt).getTime();
  if (!Number.isFinite(started)) return false;
  const threshold = now.getTime() - staleAfterDays * 24 * 60 * 60 * 1000;
  return started <= threshold;
}

export function stockTakeAgeDays(startedAt: Date | string, now: Date = new Date()): number | null {
  const started = new Date(startedAt).getTime();
  if (!Number.isFinite(started)) return null;
  return Math.max(0, Math.floor((now.getTime() - started) / (24 * 60 * 60 * 1000)));
}
