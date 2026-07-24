/*
Rate limiting policy (sliding window):
- Login endpoint: 10 attempts per IP per 15-minute sliding window
- PIN endpoint: 10 attempts per IP per 15-minute sliding window
- Forgot password endpoint: 5 attempts per IP per 60-minute sliding window
- Window type: sliding (timestamp-based), not fixed clock periods
*/

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

function getBucketKey(ip: string, key: string): string {
  const normalizedIp = ip.trim() || 'unknown';
  return `${key}:${normalizedIp}`;
}

function pruneTimestamps(timestamps: number[], now: number, windowMs: number): number[] {
  const threshold = now - windowMs;
  return timestamps.filter((timestamp) => timestamp > threshold);
}

function computeResetAt(timestamps: number[], now: number, windowMs: number): Date {
  if (timestamps.length === 0) {
    return new Date(now + windowMs);
  }

  const oldestTimestamp = timestamps[0] ?? now;
  return new Date(oldestTimestamp + windowMs);
}

export function checkRateLimit(
  ip: string,
  key: string,
  maxAttempts = 10,
  windowMs = 15 * 60 * 1000,
): RateLimitResult {
  const now = Date.now();
  const bucketKey = getBucketKey(ip, key);
  const current = buckets.get(bucketKey);

  const activeTimestamps = pruneTimestamps(current?.timestamps ?? [], now, windowMs);
  const currentCount = activeTimestamps.length;

  if (currentCount >= maxAttempts) {
    buckets.set(bucketKey, { timestamps: activeTimestamps });
    return {
      allowed: false,
      remaining: 0,
      resetAt: computeResetAt(activeTimestamps, now, windowMs),
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, maxAttempts - currentCount),
    resetAt: computeResetAt(activeTimestamps, now, windowMs),
  };
}

export function recordFailedAttempt(
  ip: string,
  key: string,
  windowMs = 15 * 60 * 1000,
): RateLimitResult {
  const now = Date.now();
  const bucketKey = getBucketKey(ip, key);
  const current = buckets.get(bucketKey);

  const activeTimestamps = pruneTimestamps(current?.timestamps ?? [], now, windowMs);
  activeTimestamps.push(now);
  buckets.set(bucketKey, { timestamps: activeTimestamps });

  const maxAttempts = 10;
  return {
    allowed: activeTimestamps.length <= maxAttempts,
    remaining: Math.max(0, maxAttempts - activeTimestamps.length),
    resetAt: computeResetAt(activeTimestamps, now, windowMs),
  };
}

export function clearRateLimitBucket(ip: string, key: string): void {
  buckets.delete(getBucketKey(ip, key));
}

function cleanupRateLimitBuckets(defaultWindowMs = 15 * 60 * 1000): void {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    const activeTimestamps = pruneTimestamps(bucket.timestamps, now, defaultWindowMs);
    if (activeTimestamps.length === 0) {
      buckets.delete(key);
    } else {
      buckets.set(key, { timestamps: activeTimestamps });
    }
  }
}

if (typeof globalThis.setInterval !== 'undefined') {
  globalThis.setInterval(() => {
    cleanupRateLimitBuckets();
  }, 60 * 60 * 1000);
}
