import { ApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/prisma';

/**
 * ARGUS #98 — printed references are the first 8 characters of a cuid.
 *
 * Receipts/tables show `CMWGA0KT`, but lookups historically required the full
 * 25/32-character id. Every entry point resolves through this tenant-scoped
 * helper instead, and an 8-character prefix that is not unique fails with an
 * explicit ambiguity error rather than picking an arbitrary row.
 */

/** Below this a prefix is too broad to be a useful lookup. */
const MIN_REFERENCE_LENGTH = 4;

/** cuid v1 is 25 chars; anything this long is treated as an exact id. */
const FULL_ID_MIN_LENGTH = 20;

/**
 * Resolve a sale reference (printed 8-char reference or full id) to the real
 * id in `tenantId`. Throws a typed 400/404/409 `ApiError`.
 */
export async function resolveSaleIdByReference(
  tenantId: string,
  reference: string,
): Promise<string> {
  const trimmed = reference.trim();
  if (trimmed.length === 0) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'A sale reference or ID is required.');
  }

  // Full ids keep the old exact lookup (and the primary-key index).
  if (trimmed.length >= FULL_ID_MIN_LENGTH) {
    const exact = await prisma.sale.findFirst({
      where: { id: trimmed, tenantId },
      select: { id: true },
    });
    if (exact) return exact.id;
  }

  if (trimmed.length < MIN_REFERENCE_LENGTH) {
    throw new ApiError(
      400,
      'VALIDATION_ERROR',
      'Enter at least 4 characters of the printed sale reference.',
    );
  }

  // cuid ids are lowercase; the printed reference is uppercased for display.
  const prefix = trimmed.toLowerCase();
  const matches = await prisma.sale.findMany({
    where: { tenantId, id: { startsWith: prefix } },
    select: { id: true },
    take: 2,
  });

  return selectReferenceMatch(trimmed, matches).id;
}

/**
 * Pick the single matching row for a reference, or throw the typed
 * not-found/ambiguous error. Kept pure so the ambiguity contract is testable
 * without a database.
 */
export function selectReferenceMatch<T extends { id: string }>(
  reference: string,
  matches: readonly T[],
): T {
  if (matches.length === 1) return matches[0]!;
  if (matches.length > 1) {
    throw new ApiError(
      409,
      'SALE_REFERENCE_AMBIGUOUS',
      `Reference ${reference.toUpperCase()} matches more than one sale. Enter more characters or the full sale ID.`,
    );
  }

  throw new ApiError(
    404,
    'NOT_FOUND',
    `No sale matches reference ${reference.toUpperCase()}.`,
  );
}
