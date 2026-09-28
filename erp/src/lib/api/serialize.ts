import 'server-only';

import Decimal from 'decimal.js';

/**
 * INF-04 — decimal / JSON serialization contract.
 *
 * | Concern                | Rule                                                        |
 * |------------------------|-------------------------------------------------------------|
 * | Money in JSON responses| 2-dp string ("1890.00") — lossless for LKR, matches the     |
 * |                        | already-proven rate-card contract (Module 25 pins)          |
 * | Money in request bodies| string-or-number, ≤2 decimals — validated by `zPrice`       |
 * | Quantities (stock/weight) | JS numbers where integer-or-2dp; documented per field    |
 * | Never                  | raw Prisma Decimal objects in responses                     |
 *
 * Services return DTOs (see `toRawMaterialItem` pattern), routes serialize via
 * these helpers so the wire shape is a decision, not an accident of
 * `JSON.stringify(Decimal)`.
 */

/** Anything Prisma/decimal.js may hand back for a Decimal column. */
export type DecimalLike = { toFixed(precision: number): string } | string | number | null | undefined;

/** Prisma Decimal → fixed 2-dp string. Throws on null — use the OrNull form. */
export function serializeMoney(value: DecimalLike): string {
  return serializeMoneyOrNull(value) ?? '0.00';
}

export function serializeMoneyOrNull(value: DecimalLike): string | null {
  if (value === null || value === undefined) return null;
  try {
    return new Decimal(value instanceof Object ? value.toFixed(10) : value).toFixed(2);
  } catch {
    // Unparseable Decimal-ish input: surface as null rather than crash the route.
    return null;
  }
}

/** Prisma Decimal → JS number (display-only; do not use for money math). */
export function serializeNumber(value: DecimalLike): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value instanceof Object ? value.toFixed(10) : value);
  return Number.isFinite(n) ? n : null;
}
