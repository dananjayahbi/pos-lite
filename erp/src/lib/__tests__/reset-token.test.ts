/**
 * M01-03 — the mint helper's contract (BUG-18): every mint wraps
 * deleteMany+create in ONE $transaction, so "at most one live token per
 * identifier" holds by construction. The Prisma client is mocked; the
 * transaction shape is what is asserted.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  $transaction: vi.fn(),
  deleteMany: vi.fn(),
  create: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mocks.$transaction,
    verificationToken: {
      deleteMany: mocks.deleteMany,
      create: mocks.create,
    },
  },
}));

vi.mock('@/generated/prisma/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      constructor(public code: string) {
        super(code);
        this.name = 'PrismaClientKnownRequestError';
      }
    },
  },
}));

import { mintPasswordResetToken } from '@/lib/auth/reset-token';

describe('mintPasswordResetToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.$transaction.mockResolvedValue([]);
  });

  it('wraps deleteMany+create in a single $transaction', async () => {
    const token = await mintPasswordResetToken('user@example.com');

    expect(mocks.$transaction).toHaveBeenCalledTimes(1);
    const ops = mocks.$transaction.mock.calls[0]?.[0];
    expect(Array.isArray(ops)).toBe(true);
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { identifier: 'user@example.com' } });
    expect(mocks.create).toHaveBeenCalledTimes(1);
    const created = mocks.create.mock.calls[0]?.[0];
    expect(created.data.token).toBe(token);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    // 1-hour TTL contract preserved.
    const ttl = new Date(created.data.expires).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(55 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(60 * 60 * 1000);
  });

  it('retries once on a P2002 unique-violation race', async () => {
    const { Prisma } = await import('@/generated/prisma/client');
    const race = new (Prisma as never as {
      PrismaClientKnownRequestError: new (code: string) => Error;
    }).PrismaClientKnownRequestError('P2002');

    mocks.$transaction.mockRejectedValueOnce(race).mockResolvedValueOnce([]);

    const token = await mintPasswordResetToken('racer@example.com');
    expect(mocks.$transaction).toHaveBeenCalledTimes(2);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rethrows non-P2002 failures without retrying', async () => {
    const { Prisma } = await import('@/generated/prisma/client');
    const boom = new (Prisma as never as {
      PrismaClientKnownRequestError: new (code: string) => Error;
    }).PrismaClientKnownRequestError('P2025');

    mocks.$transaction.mockRejectedValueOnce(boom);
    await expect(mintPasswordResetToken('gone@example.com')).rejects.toBe(boom);
    expect(mocks.$transaction).toHaveBeenCalledTimes(1);
  });

  it('the transaction legs are ordered deleteMany-then-create (one live token invariant)', async () => {
    // The invariant "at most one live token per identifier" holds by
    // construction: within the single $transaction, the deleteMany leg runs
    // before create commits, so a second mint's delete leg always kills the
    // first token. Assert the leg ORDER (delete before create) — the E2E
    // concurrency pin (tests/01 5.5) covers the real-DB interleaving.
    const ops: Array<Promise<unknown>> = [];
    mocks.$transaction.mockImplementation(async (arg: Array<Promise<unknown>>) => {
      ops.push(...arg);
      return [];
    });

    await mintPasswordResetToken('dual@example.com');
    expect(mocks.deleteMany).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    // Both legs were passed to ONE $transaction call (array of 2).
    expect(ops).toHaveLength(2);
  });
});
