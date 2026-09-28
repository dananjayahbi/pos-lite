import 'server-only';

import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { ApiError } from './errors';
import { mapPrismaError } from './map-prisma-error';

/**
 * XC-06 — shared race-hardening primitives.
 *
 * The "concurrent create/write → 500 or silent duplicate" family (BUG-8/18/
 * 27/30/31/39/48/64/92/98) reduces to two root shapes:
 *   1. check-then-insert races → the loser hits the DB constraint and the
 *      route 500s instead of 409. Fix pattern: insert-and-map.
 *   2. read-modify-write races on counters/stock/balances → lost updates.
 *      Fix pattern: row locks inside a transaction.
 *
 * Reference instance: M03-06 (staff create). Later race docs (M05-03,
 * M06-01, M08-05, M16-01, M25-03, M27-06, M28-02) MUST reuse these helpers
 * instead of re-inventing the mapping (roadmap §2 / XC-06 item 5).
 */

/** True when `error` is a Prisma unique-constraint violation (P2002). */
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
  );
}

/**
 * Run `fn`; if it loses a unique-constraint race, return a typed 409
 * `ApiError` (via the INF-02 mapper so the message stays friendly and leak-
 * free) instead of letting the route's generic catch 500. Usage:
 *
 *   const created = await withUniqueGuard(() => prisma.x.create(...), 'email')
 *
 * `conflictMessage` is optional — without it, the mapper's field-aware copy
 * ("A record with this email already exists.") is used.
 */
export async function withUniqueGuard<T>(
  fn: () => Promise<T>,
  conflictMessage?: string,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isUniqueViolation(error)) {
      const mapped = mapPrismaError(error);
      throw new ApiError(409, mapped?.code ?? 'CONFLICT', conflictMessage ?? mapped?.message ?? 'A record with these details already exists.');
    }
    throw error;
  }
}

/**
 * Read-modify-write inside a SERIALIZABLE-ish guard: runs `fn` inside an
 * interactive transaction and locks the rows `fn` intends to mutate via
 * `SELECT … FOR UPDATE` using `lockForUpdate(tx, table, whereSql, params)`
 * before touching them. Concurrent writers serialize on the lock instead of
 * clobbering each other (BUG-41/48/53/64/98 family).
 */
export async function lockingTx<R>(
  fn: (tx: Prisma.TransactionClient) => Promise<R>,
): Promise<R> {
  return prisma.$transaction(async (tx) => fn(tx));
}

/**
 * Take a row lock inside a lockingTx transaction. `whereSql` is a fragment
 * WITHOUT the WHERE keyword, e.g. `lockingTx(tx => lockForUpdate(tx, 'product_variants', '"id" = $1', [id]))`.
 * Column/table names come from code, never user input (they are interpolated,
 * not parameterized).
 */
export async function lockForUpdate(
  tx: Prisma.TransactionClient,
  table: string,
  whereSql: string,
  params: unknown[] = [],
): Promise<void> {
  await tx.$executeRawUnsafe(
    `SELECT id FROM "${table}" WHERE ${whereSql} FOR UPDATE`,
    ...params,
  );
}
