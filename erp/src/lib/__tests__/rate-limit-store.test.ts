/**
 * M01-02 — unit coverage for the DB-backed sliding-window limiter.
 * The Prisma client is mocked: no DB is touched (the gate contract is the
 * window math + upsert shape, not Postgres itself).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    rateLimitBucket: {
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
      delete: mocks.delete,
    },
  },
}));

import {
  checkAndRecordRateLimit,
  isDbRateLimitEnabled,
} from '@/lib/rate-limit-store';

const HOUR = 60 * 60 * 1000;

describe('isDbRateLimitEnabled', () => {
  const original = process.env.RATE_LIMIT_DB;
  beforeEach(() => {
    if (original === undefined) delete process.env.RATE_LIMIT_DB;
    else process.env.RATE_LIMIT_DB = original;
  });

  it('is off by default (in-memory dev fallback)', () => {
    delete process.env.RATE_LIMIT_DB;
    expect(isDbRateLimitEnabled()).toBe(false);
  });

  it('turns on with RATE_LIMIT_DB=1 and off with =0', () => {
    process.env.RATE_LIMIT_DB = '1';
    expect(isDbRateLimitEnabled()).toBe(true);
    process.env.RATE_LIMIT_DB = '0';
    expect(isDbRateLimitEnabled()).toBe(false);
  });
});

describe('checkAndRecordRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upsert.mockResolvedValue({});
  });

  it('allows and records a hit on an empty bucket', async () => {
    mocks.findUnique.mockResolvedValue(null);
    const result = await checkAndRecordRateLimit('forgot:1.2.3.4', 5, HOUR);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    const call = mocks.upsert.mock.calls[0]?.[0];
    expect(call.where).toEqual({ bucketKey: 'forgot:1.2.3.4' });
    expect(call.create.timestamps).toHaveLength(1);
  });

  it('prunes timestamps outside the window before deciding', async () => {
    const now = Date.now();
    mocks.findUnique.mockResolvedValue({
      timestamps: [now - 2 * HOUR, now - 90 * 60 * 1000], // both stale
    });

    const result = await checkAndRecordRateLimit('forgot:ip', 5, HOUR);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4); // stale entries did not count

    const call = mocks.upsert.mock.calls[0]?.[0];
    expect(call.update.timestamps).toHaveLength(1); // only the fresh hit persisted
  });

  it('rejects with allowed:false once the window is full, without adding a hit', async () => {
    const now = Date.now();
    const full = [now - 4000, now - 3000, now - 2000, now - 1000, now - 500];
    mocks.findUnique.mockResolvedValue({ timestamps: full });

    const result = await checkAndRecordRateLimit('forgot:ip', 5, HOUR);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    // resetAt = oldest + window
    expect(result.resetAt.getTime()).toBe((full[0] ?? 0) + HOUR);

    const call = mocks.upsert.mock.calls[0]?.[0];
    expect(call.update.timestamps).toEqual(full); // window persisted unchanged
  });

  it('survives a restart: a stored full window keeps blocking (BUG-16 contract)', async () => {
    const now = Date.now();
    mocks.findUnique.mockResolvedValue({
      timestamps: [now - 1000, now - 900, now - 800, now - 700, now - 600],
    });
    const first = await checkAndRecordRateLimit('forgot:ip', 5, HOUR);
    const second = await checkAndRecordRateLimit('forgot:ip', 5, HOUR);
    expect(first.allowed).toBe(false);
    expect(second.allowed).toBe(false);
  });

  it('ignores non-numeric junk in the stored JSON array', async () => {
    mocks.findUnique.mockResolvedValue({ timestamps: ['x', 42, null, {}] });
    const result = await checkAndRecordRateLimit('forgot:ip', 5, HOUR);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });
});
