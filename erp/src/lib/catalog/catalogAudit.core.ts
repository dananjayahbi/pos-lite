/**
 * Catalog audit snapshots (ARGUS #167 / #175).
 *
 * Categories and brands are small, flat records, so the audit trail should be
 * an explicit, bounded snapshot of the fields a store admin can actually edit.
 * Keeping this pure means the service and the tests agree on exactly which
 * columns enter the AuditLog `before` / `after` payloads (no accidental
 * relation dumps or tenant internals).
 */

/** JSON-safe scalar values allowed in a catalog audit snapshot. */
export type CatalogAuditValue = string | number | boolean | null;

export type CatalogAuditSnapshot = Record<string, CatalogAuditValue>;

export interface CategoryAuditSnapshot extends CatalogAuditSnapshot {
  name: string;
  description: string | null;
  sortOrder: number;
  imageUrl: string | null;
}

export interface BrandAuditSnapshot extends CatalogAuditSnapshot {
  name: string;
  description: string | null;
  logoUrl: string | null;
}

/** Bounded snapshot of a category row for CATEGORY_CREATED / CATEGORY_UPDATED. */
export function categoryAuditSnapshot(row: {
  name: string;
  description: string | null;
  sortOrder: number;
  imageUrl: string | null;
}): CategoryAuditSnapshot {
  return {
    name: row.name,
    description: row.description ?? null,
    sortOrder: row.sortOrder,
    imageUrl: row.imageUrl ?? null,
  };
}

/** Bounded snapshot of a brand row for BRAND_CREATED / BRAND_UPDATED. */
export function brandAuditSnapshot(row: {
  name: string;
  description: string | null;
  logoUrl: string | null;
}): BrandAuditSnapshot {
  return {
    name: row.name,
    description: row.description ?? null,
    logoUrl: row.logoUrl ?? null,
  };
}

/**
 * Names of the snapshot fields whose persisted value changed.
 *
 * Used to avoid writing a misleading update row when a PATCH only repeats the
 * current values. Compared with `Object.is`, which is correct for the scalar
 * types a catalog snapshot allows.
 */
export function changedAuditFields(
  before: CatalogAuditSnapshot,
  after: CatalogAuditSnapshot,
): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => !Object.is(before[key], after[key]));
}
