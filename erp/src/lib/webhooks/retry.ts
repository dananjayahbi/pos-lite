/**
 * M33-02 (OBS-62) — webhook auto-retry with exponential backoff.
 *
 * Before this module a FAILED delivery was terminal: the only recovery was an
 * owner manually clicking "Retry" in the UI, so a receiver that was down for a
 * few minutes silently lost every event sent during the outage. The schedule
 * below keeps retrying on a widening cadence for ~13 hours, which comfortably
 * covers a deploy window or a short network partition without hammering a
 * receiver that is deliberately offline.
 *
 * The arithmetic lives here (pure functions, no I/O) so the exact cadence and
 * the exhaustion boundary are unit-testable without a database.
 */

/** Scheduled retries after the original send — one per backoff step. */
export const MAX_RETRIES = 5;

/** Total sends per delivery: the original inline send plus every retry. */
export const MAX_ATTEMPTS = MAX_RETRIES + 1;

/**
 * Minutes to wait AFTER a failed attempt, keyed by the attempt that failed.
 * Attempt 1 is the original inline send, so the five retries are scheduled at
 * 1m, 5m, 25m, 2h and 10h respectively — the schedule named in M33-02.
 */
const BACKOFF_MINUTES = [1, 5, 25, 120, 600] as const;

const MINUTE_MS = 60_000;

/**
 * Delay before attempt number `attempt + 1`, given that `attempt` just failed.
 * Attempt 1 (the original inline send) → 1 minute, then 5m, 25m, 2h, 10h.
 * Returns `null` when no further attempt is permitted (`attempt >= MAX_ATTEMPTS`).
 */
export function nextRetryDelayMs(attempt: number): number | null {
  if (!Number.isInteger(attempt) || attempt < 1) return null;
  const minutes = BACKOFF_MINUTES[attempt - 1];
  if (minutes === undefined) return null;
  return minutes * MINUTE_MS;
}
/** Convenience wrapper for callers that want a concrete Date to persist. */
export function computeNextRetryAt(attempt: number, from: Date = new Date()): Date | null {
  const delay = nextRetryDelayMs(attempt);
  return delay === null ? null : new Date(from.getTime() + delay);
}

/** True once the delivery has consumed every allowed attempt. */
export function isExhausted(attempt: number): boolean {
  return attempt >= MAX_ATTEMPTS;
}
/** The status a delivery should carry after `attempt` failed attempts. */
export function statusAfterFailure(attempt: number): 'FAILED' | 'EXHAUSTED' {
  return isExhausted(attempt) ? 'EXHAUSTED' : 'FAILED';
}

/** Minimal shape needed to decide whether a row is due for a retry. */
export interface RetryCandidate {
  status: string;
  attempt: number | null | undefined;
  nextRetryAt: Date | null | undefined;
}

/**
 * A row is due when it previously failed, still has attempts left, and its
 * scheduled retry time has arrived. `status: 'FAILED'` is required so a row
 * that already reached EXHAUSTED (or SUCCESS) is never resurrected by a late
 * cron tick; a null/missing `nextRetryAt` is treated as "not scheduled".
 */
export function isDeliveryDue(row: RetryCandidate, now: Date = new Date()): boolean {
  if (row.status !== 'FAILED') return false;
  const attempt = row.attempt ?? 1;
  if (isExhausted(attempt)) return false;
  if (!row.nextRetryAt) return false;
  return new Date(row.nextRetryAt).getTime() <= now.getTime();
}