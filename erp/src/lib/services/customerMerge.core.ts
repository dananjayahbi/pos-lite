/**
 * Customer merge planning (ARGUS #320).
 *
 * `customer:merge` existed with no route or UI. The database has no merge
 * endpoint, so the operation is expressed as: re-point the duplicate's
 * dependent rows at the primary, fold its lifecycle totals/tags into the
 * primary, then soft-delete the duplicate (phones remain reserved by the
 * tenant-unique constraint). This module keeps the field-folding decision pure
 * so it can be tested without Prisma.
 */

export interface MergeCustomerSnapshot {
  id: string;
  name: string;
  phone: string;
  phone2?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  gender?: string | null;
  birthday?: Date | null;
  notes?: string | null;
  tags?: readonly string[];
  creditBalance: string | number;
  totalSpend: string | number;
  lastPurchaseAt?: Date | null;
  deletedAt?: Date | null;
}

export interface MergeCustomerPlan {
  /** Fields to write on the surviving customer. */
  fields: {
    phone2: string | null;
    email: string | null;
    address: string | null;
    city: string | null;
    gender: string | null;
    birthday: Date | null;
    notes: string | null;
    tags: string[];
    creditBalance: number;
    totalSpend: number;
    lastPurchaseAt: Date | null;
  };
  /** Human summary for the audit row and the confirmation toast. */
  summary: {
    tagsAdded: number;
    creditBalance: number;
    totalSpend: number;
  };
}

function toNumber(value: string | number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function latest(a: Date | null | undefined, b: Date | null | undefined): Date | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a.getTime() >= b.getTime() ? a : b;
}

/**
 * Fold the duplicate into the primary. The primary's non-empty values win;
 * blanks are filled from the duplicate. Spending and store credit are summed
 * (they are the same person's money), tags are unioned case-insensitively, and
 * the most recent purchase date survives.
 */
export function buildCustomerMergePlan(
  primary: MergeCustomerSnapshot,
  duplicate: MergeCustomerSnapshot,
): MergeCustomerPlan {
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const tag of [...(primary.tags ?? []), ...(duplicate.tags ?? [])]) {
    const key = tag.trim().toUpperCase();
    if (key === '' || seen.has(key)) continue;
    seen.add(key);
    tags.push(key);
  }

  const pick = (preferred: string | null | undefined, fallback: string | null | undefined) => {
    const value = preferred?.trim();
    return value && value !== '' ? value : (fallback?.trim() || null);
  };

  const creditBalance = round2(
    toNumber(primary.creditBalance) + toNumber(duplicate.creditBalance),
  );
  const totalSpend = round2(toNumber(primary.totalSpend) + toNumber(duplicate.totalSpend));

  return {
    fields: {
      phone2: pick(primary.phone2, duplicate.phone2),
      email: pick(primary.email, duplicate.email),
      address: pick(primary.address, duplicate.address),
      city: pick(primary.city, duplicate.city),
      gender: primary.gender ?? duplicate.gender ?? null,
      birthday: primary.birthday ?? duplicate.birthday ?? null,
      notes: pick(primary.notes, duplicate.notes),
      tags,
      creditBalance,
      totalSpend,
      lastPurchaseAt: latest(primary.lastPurchaseAt, duplicate.lastPurchaseAt),
    },
    summary: {
      tagsAdded: tags.length - new Set((primary.tags ?? []).map((t) => t.trim().toUpperCase())).size,
      creditBalance,
      totalSpend,
    },
  };
}

/** Reject obviously invalid merge pairs before any write. */
export function mergeCustomerIdsError(
  primaryId: string,
  duplicateId: string,
  primaryExists: boolean,
  duplicateExists: boolean,
): string | null {
  if (!primaryId || !duplicateId) return 'Both customers are required';
  if (primaryId === duplicateId) return 'Choose two different customers';
  if (!primaryExists) return 'The customer to keep was not found';
  if (!duplicateExists) return 'The customer to merge was not found';
  return null;
}
