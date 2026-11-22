/**
 * Customer CSV import helpers (ARGUS #318).
 *
 * Any Birthday value that was not parseable silently became `null` with no row
 * error, the reported "Imported" count was the number of validated rows rather
 * than rows actually inserted (an archived duplicate was counted then skipped
 * by the unique constraint), and tags kept their original case so `vip` never
 * matched the `VIP` filter. These pure helpers fix all three without touching
 * the Prisma schema.
 */
import { canonicalCustomerTag } from '@/lib/services/customerTag.core';

export const CUSTOMER_IMPORT_MIN_BIRTHDAY_YEAR = 1900;

/**
 * Parse a CSV birthday. Only `YYYY-MM-DD` real calendar dates are accepted;
 * anything else returns `null` so the caller can emit a row error instead of a
 * silent null.
 */
export function parseCustomerBirthday(value: string | null | undefined): Date | null {
  const raw = value?.trim() ?? '';
  if (raw === '') return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < CUSTOMER_IMPORT_MIN_BIRTHDAY_YEAR) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  // A birthday in the future is a data-entry error, not a birthday.
  if (date.getTime() > Date.now()) return null;
  return date;
}

/** True when the raw cell is non-empty but not a valid birthday. */
export function isInvalidCustomerBirthday(value: string | null | undefined): boolean {
  const raw = value?.trim() ?? '';
  return raw !== '' && parseCustomerBirthday(raw) === null;
}

/** Split, canonicalize (trim + upper-case) and de-duplicate tags. */
export function normalizeImportTags(value: string | null | undefined): string[] {
  const raw = value?.trim() ?? '';
  if (raw === '') return [];
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((tag) => canonicalCustomerTag(tag))
        .filter((tag) => tag !== ''),
    ),
  );
}

export interface ImportCountReconciliation {
  /** Rows the database actually inserted. */
  imported: number;
  /** Validated rows the database skipped (unique-constraint races). */
  skipped: number;
  /** Extra skipped-detail lines for the shortfall. */
  notes: string[];
}

/**
 * Reconcile the validated rows with `createMany`'s actual count. A shortfall
 * can only be a unique-constraint skip (a concurrent insert), and it must be
 * reported as skipped - not counted as imported.
 */
export function reconcileImportCounts(
  validatedCount: number,
  insertedCount: number,
): ImportCountReconciliation {
  const imported = Math.max(0, Math.min(validatedCount, insertedCount));
  const skipped = Math.max(0, validatedCount - imported);
  return {
    imported,
    skipped,
    notes:
      skipped > 0
        ? [`${skipped} row${skipped === 1 ? '' : 's'} skipped by the database (duplicate phone)`]
        : [],
  };
}
