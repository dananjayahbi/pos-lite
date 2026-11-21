/**
 * Tenant raw-material unit catalog (ARGUS #481).
 *
 * Units are tenant-managed rows and can be renamed, deactivated or (when
 * unused) soft-deleted. A material stores only the stable `key`, so every
 * display surface must resolve its current name/short label from the tenant's
 * catalog. The catalog deliberately includes inactive and soft-deleted rows:
 * a material (or historical production log) that still references a key must
 * keep resolving instead of falling back to the raw key.
 *
 * Pure so the server services and tests share exactly one resolution rule.
 */
import { humanizeUnitKey } from '@/lib/services/rawMaterial.core';

export interface RawMaterialUnitCatalogRow {
  key: string;
  name: string;
  shortLabel: string;
  isActive: boolean;
  deletedAt?: Date | null | undefined;
}

export interface RawMaterialUnitCatalogEntry {
  key: string;
  name: string;
  shortLabel: string;
  isActive: boolean;
  isDeleted: boolean;
}

export type RawMaterialUnitCatalog = ReadonlyMap<string, RawMaterialUnitCatalogEntry>;

/**
 * Build a key -> labels map from every row the tenant has, including inactive
 * and soft-deleted units. When a key somehow appears twice, a live row wins
 * over a deleted one and the first live row is kept.
 */
export function buildRawMaterialUnitCatalog(
  rows: ReadonlyArray<RawMaterialUnitCatalogRow>,
): RawMaterialUnitCatalog {
  const catalog = new Map<string, RawMaterialUnitCatalogEntry>();

  for (const row of rows) {
    const entry: RawMaterialUnitCatalogEntry = {
      key: row.key,
      name: row.name,
      shortLabel: row.shortLabel,
      isActive: row.isActive,
      isDeleted: row.deletedAt !== null && row.deletedAt !== undefined,
    };
    const existing = catalog.get(row.key);
    if (!existing || (existing.isDeleted && !entry.isDeleted)) {
      catalog.set(row.key, entry);
    }
  }

  return catalog;
}

export interface RawMaterialUnitLabels {
  name: string;
  shortLabel: string;
}

/**
 * Resolve a stored key to the tenant's labels. Unknown keys fall back to a
 * humanised name and the raw key as the short label (the old behaviour), so a
 * truly missing unit is still readable.
 */
export function resolveRawMaterialUnitLabels(
  catalog: RawMaterialUnitCatalog | null | undefined,
  key: string,
): RawMaterialUnitLabels {
  const entry = catalog?.get(key);
  if (entry) {
    return { name: entry.name, shortLabel: entry.shortLabel };
  }
  return { name: humanizeUnitKey(key), shortLabel: key };
}

export function resolveRawMaterialUnitName(
  catalog: RawMaterialUnitCatalog | null | undefined,
  key: string,
): string {
  return resolveRawMaterialUnitLabels(catalog, key).name;
}

export function resolveRawMaterialUnitShortLabel(
  catalog: RawMaterialUnitCatalog | null | undefined,
  key: string,
): string {
  return resolveRawMaterialUnitLabels(catalog, key).shortLabel;
}
