/**
 * M32-02 (OBS-61) — the chunked read-all sweep.
 *
 * OBS-61's risk was a single unbounded `updateMany` locking the whole unread
 * set. The refactor is only safe if it preserves the route's exact-count
 * contract (tests/32 F10/A3/S4), so these tests drive a fake in-memory table
 * and assert both the batching shape and the summed count.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Row {
  id: string;
  tenantId: string;
  recipientId: string;
  isRead: boolean;
}

const mocks = vi.hoisted(() => ({
  rows: [] as Row[],
  findMany: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    notificationRecord: {
      findMany: mocks.findMany,
      updateMany: mocks.updateMany,
    },
  },
}));

import { markAllNotificationsRead } from '@/lib/notifications/read-all';
import { READ_ALL_CHUNK_SIZE } from '@/lib/notifications/read-all-config';

const TENANT = 'tenant-1';
const RECIPIENT = 'owner-1';

function seedUnread(count: number, recipientId = RECIPIENT): void {
  for (let i = 0; i < count; i += 1) {
    mocks.rows.push({
      id: `n-${recipientId}-${i}`,
      tenantId: TENANT,
      recipientId,
      isRead: false,
    });
  }
}

/** Mirrors the real query shape: tenant+recipient scoped, unread only, capped. */
function unreadFor(recipientId: string): Row[] {
  return mocks.rows.filter(
    (r) => r.tenantId === TENANT && r.recipientId === recipientId && !r.isRead,
  );
}

/** Narrow shapes of the two Prisma calls the sweep is allowed to make. */
interface UpdateManyArgs {
  where: { id: { in: string[] }; tenantId: string; recipientId: string; isRead: boolean };
  data: { isRead: boolean };
}

interface FindManyArgs {
  where: { tenantId: string; recipientId: string; isRead: boolean };
  take: number;
}

/** Ordered list of the chunk sizes sent to `updateMany` (each ≤ the chunk size). */
function chunkSizes(): number[] {
  return mocks.updateMany.mock.calls.map(([args]) => (args.where.id.in as string[]).length);
}

/** The first argument of the Nth `updateMany` call, or a failing assertion. */
function writeArgs(index: number): UpdateManyArgs {
  const call = mocks.updateMany.mock.calls[index];
  expect(call, `updateMany call #${index} must exist`).toBeTruthy();
  return call?.[0] as unknown as UpdateManyArgs;
}

/** The first argument of the Nth `findMany` call, or a failing assertion. */
function readArgs(index: number): FindManyArgs {
  const call = mocks.findMany.mock.calls[index];
  expect(call, `findMany call #${index} must exist`).toBeTruthy();
  return call?.[0] as unknown as FindManyArgs;
}

beforeEach(() => {
  mocks.rows = [];
  mocks.findMany.mockReset();
  mocks.updateMany.mockReset();

  mocks.findMany.mockImplementation(({ where, take }: { where: { recipientId: string }; take: number }) =>
    Promise.resolve(unreadFor(where.recipientId).slice(0, take).map((r) => ({ id: r.id }))),
  );

  mocks.updateMany.mockImplementation(
    ({ where }: { where: { id: { in: string[] }; recipientId: string } }) => {
      const targets = new Set(where.id.in);
      let count = 0;
      for (const row of mocks.rows) {
        // An already-read row is not counted again — proves the sweep cannot
        // double-count a row a concurrent mark-read flipped first.
        if (targets.has(row.id) && row.recipientId === where.recipientId && !row.isRead) {
          row.isRead = true;
          count += 1;
        }
      }
      return Promise.resolve({ count });
    },
  );
});

describe('markAllNotificationsRead (M32-02/OBS-61)', () => {
  it('sweeps in chunks of READ_ALL_CHUNK_SIZE and returns the summed exact count', async () => {
    seedUnread(1200);

    await expect(markAllNotificationsRead(TENANT, RECIPIENT)).resolves.toBe(1200);

    // 1200 unread / 500 per chunk → 3 write statements, not one unbounded write.
    expect(mocks.updateMany).toHaveBeenCalledTimes(3);
    expect(READ_ALL_CHUNK_SIZE).toBe(500);
    expect(chunkSizes()).toEqual([500, 500, 200]);
    for (const size of chunkSizes()) {
      expect(size).toBeLessThanOrEqual(READ_ALL_CHUNK_SIZE);
    }

    // Drains fully: no unread row survives, and the loop terminated (4th read empty).
    expect(unreadFor(RECIPIENT)).toHaveLength(0);
    expect(mocks.findMany).toHaveBeenCalledTimes(4);
  });

  it('scopes every statement by tenant + recipient + unread', async () => {
    seedUnread(3);

    await markAllNotificationsRead(TENANT, RECIPIENT);

    expect(readArgs(0).where).toEqual({ tenantId: TENANT, recipientId: RECIPIENT, isRead: false });

    const write = writeArgs(0);
    expect(write.where).toMatchObject({ tenantId: TENANT, recipientId: RECIPIENT, isRead: false });
    expect(write.data).toEqual({ isRead: true });
  });

  it("never touches another recipient's rows", async () => {
    seedUnread(3, RECIPIENT);
    seedUnread(5, 'cashier-1');

    await expect(markAllNotificationsRead(TENANT, RECIPIENT)).resolves.toBe(3);

    // The cashier's five rows are still unread — read-all is recipient-scoped,
    // which is exactly what tests/32 S4 pins as `count: 0` for a cashier call.
    expect(unreadFor('cashier-1')).toHaveLength(5);
    await expect(markAllNotificationsRead(TENANT, 'cashier-1')).resolves.toBe(5);
  });

  it('is a zero-count no-op on an already-read inbox (A3)', async () => {
    await expect(markAllNotificationsRead(TENANT, RECIPIENT)).resolves.toBe(0);
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.findMany).toHaveBeenCalledTimes(1);
  });

  it('a zero-count chunk does not terminate the sweep early (no rows lost to a race)', async () => {
    seedUnread(2);
    // Simulate a concurrent writer landing between the re-select and the
    // updateMany: the first chunk's write reports 0. Termination is driven by the
    // *empty re-select*, not by the count, so the sweep retries instead of
    // silently abandoning rows it had already seen.
    mocks.updateMany.mockImplementationOnce(() => Promise.resolve({ count: 0 }));

    await expect(markAllNotificationsRead(TENANT, RECIPIENT)).resolves.toBe(2);
    // Pass 1 saw the rows (count 0), pass 2 re-selected and actually flipped them,
    // pass 3 found an empty set and stopped.
    expect(mocks.updateMany).toHaveBeenCalledTimes(2);
    expect(mocks.findMany).toHaveBeenCalledTimes(3);
    expect(unreadFor(RECIPIENT)).toHaveLength(0);
  });
});