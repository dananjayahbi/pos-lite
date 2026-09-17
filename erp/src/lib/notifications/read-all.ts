import { prisma } from '@/lib/prisma';
import { READ_ALL_CHUNK_SIZE } from './read-all-config';

/**
 * M32-02 (OBS-61) — chunked "mark every unread notification read".
 *
 * Replaces the previous single unbounded `updateMany`, which took row locks for
 * the caller's entire unread set in one statement. The sweep now marks at most
 * `READ_ALL_CHUNK_SIZE` rows per statement, so lock contention is bounded by
 * one chunk instead of the backlog's size.
 *
 * Contract (pinned by tests/32 F10/A3/S4 — unchanged by this refactor):
 *  - returns the **total number of rows actually flipped**, i.e. the sum of the
 *    per-chunk counts;
 *  - is recipient- and tenant-scoped: never touches another user's rows;
 *  - is a safe no-op (returns 0) on an already-read inbox.
 *
 * Deliberately NOT wrapped in a `$transaction`: holding one transaction open
 * across the whole sweep would recreate exactly the long lock this batching
 * exists to avoid. Each chunk is committed on its own.
 *
 * Termination is provable: the `updateMany` filter (`id IN chunk`, same
 * tenant/recipient, `isRead: false`) is a subset of the predicate that produced
 * the chunk, so a non-empty re-select always flips at least one row unless a
 * concurrent writer read those rows first — in which case that writer has itself
 * shrunk the unread set. Either way the unread set strictly shrinks, and the loop
 * stops on the first empty re-select. Note the counter-case, pinned by the unit
 * test: a chunk reporting `count: 0` (a concurrent mark-read won the race) does
 * **not** end the sweep — termination is driven by the empty select, so rows the
 * sweep already saw are never silently abandoned.
 */
export async function markAllNotificationsRead(
  tenantId: string,
  recipientId: string,
): Promise<number> {
  let marked = 0;

  for (;;) {
    const chunk = await prisma.notificationRecord.findMany({
      where: { tenantId, recipientId, isRead: false },
      orderBy: { createdAt: 'desc' },
      take: READ_ALL_CHUNK_SIZE,
      select: { id: true },
    });

    if (chunk.length === 0) break;

    const result = await prisma.notificationRecord.updateMany({
      where: {
        id: { in: chunk.map((row) => row.id) },
        tenantId,
        recipientId,
        isRead: false,
      },
      data: { isRead: true },
    });

    marked += result.count;
  }

  return marked;
}