/**
 * M01-02 — persistent (DB-backed) sliding-window rate-limit store.
 *
 * The in-memory Map in `rate-limit.ts` resets on every dev-server restart and
 * is per-instance, which silently dropped legitimate forgot-password requests
 * (BUG-16). This module keeps the SAME sliding-window semantics but persists
 * the timestamps in `rate_limit_buckets` (see prisma/schema.prisma →
 * RateLimitBucket).
 *
 * Selection: `RATE_LIMIT_DB=1` (or any truthy value) enables the DB store;
 * otherwise the in-memory bucket is used as the documented dev fallback.
 * The DB path is exercised by the Vitest unit test with a mocked client.
 *
 * Concurrency: read-modify-write without a transaction is acceptable for a
 * best-effort limiter (worst case: one extra request slips through a burst);
 * the unique bucket key keeps the row set bounded per IP+action.
 */
import { prisma } from '@/lib/prisma';
import type { RateLimitResult } from '@/lib/rate-limit';

export function isDbRateLimitEnabled(): boolean {
  return Boolean(process.env.RATE_LIMIT_DB) && process.env.RATE_LIMIT_DB !== '0';
}

function prune(timestamps: number[], now: number, windowMs: number): number[] {
  const threshold = now - windowMs;
  return timestamps.filter((ts) => ts > threshold);
}

function computeResetAt(active: number[], now: number, windowMs: number): Date {
  if (active.length === 0) return new Date(now + windowMs);
  return new Date((active[0] ?? now) + windowMs);
}

function evaluate(
  active: number[],
  maxAttempts: number,
  now: number,
  windowMs: number,
): RateLimitResult {
  if (active.length >= maxAttempts) {
    return { allowed: false, remaining: 0, resetAt: computeResetAt(active, now, windowMs) };
  }
  return {
    allowed: true,
    remaining: Math.max(0, maxAttempts - active.length),
    resetAt: computeResetAt(active, now, windowMs),
  };
}

/**
 * Check-and-consume in one step (the forgot-password flow records every
 * accepted request, so a separate record call would double-count).
 * Returns the decision for THIS request; when allowed, the hit is recorded.
 */
export async function checkAndRecordRateLimit(
  bucketKey: string,
  maxAttempts: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();

  const existing = await prisma.rateLimitBucket.findUnique({
    where: { bucketKey },
    select: { timestamps: true },
  });

  const stored = Array.isArray(existing?.timestamps)
    ? (existing!.timestamps as unknown[]).filter((v): v is number => typeof v === 'number')
    : [];
  const active = prune(stored, now, windowMs);

  const decision = evaluate(active, maxAttempts, now, windowMs);
  if (!decision.allowed) {
    // Persist the pruned window so stale entries do not resurrect later.
    await prisma.rateLimitBucket.upsert({
      where: { bucketKey },
      create: { bucketKey, timestamps: active as unknown as never },
      update: { timestamps: active as unknown as never },
    });
    return decision;
  }

  active.push(now);
  await prisma.rateLimitBucket.upsert({
    where: { bucketKey },
    create: { bucketKey, timestamps: active as unknown as never },
    update: { timestamps: active as unknown as never },
  });

  // Same post-recording shape the in-memory recordFailedAttempt returns.
  return {
    allowed: active.length <= maxAttempts,
    remaining: Math.max(0, maxAttempts - active.length),
    resetAt: computeResetAt(active, now, windowMs),
  };
}

/** Clear a bucket (tests / ops recovery). */
export async function clearDbRateLimitBucket(bucketKey: string): Promise<void> {
  await prisma.rateLimitBucket
    .delete({ where: { bucketKey } })
    .catch(() => undefined);
}
