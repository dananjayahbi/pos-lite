import {
  PACKAGING_CATEGORIES,
  type PackagingCategory,
  type PackagingUnit,
} from '@/lib/validators/packaging.validators';

/**
 * Packaging category + unit presentation contracts.
 *
 * Categories are tenant-managed rows (`PackagingCategoryOption`); the enum in
 * the Prisma schema only pins the built-in defaults that every tenant is
 * seeded with. Labels therefore fall back from the tenant's own name (passed
 * in by the API) to the built-in label to a humanised version of the key.
 */

export const PACKAGING_CATEGORY_LABELS: Record<PackagingCategory, string> = {
  POLYMAILER: 'Polymailer',
  TAPE: 'Tape',
  LABEL: 'Label',
  BUBBLE_WRAP: 'Bubble Wrap',
  OTHER: 'Other',
};

/** Built-in categories seeded for every tenant. */
export const DEFAULT_PACKAGING_CATEGORIES: ReadonlyArray<{
  key: PackagingCategory;
  name: string;
}> = PACKAGING_CATEGORIES.map((key) => ({
  key,
  name: PACKAGING_CATEGORY_LABELS[key],
}));

/** Turn an arbitrary category key into a readable fallback label. */
export function humanizePackagingCategoryKey(key: string): string {
  return key
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Derive a stable category key from a display name, e.g. "Courier Bags"
 * becomes "COURIER_BAGS". Falls back to "CATEGORY" when the name has no
 * alphanumeric characters.
 */
export function slugifyPackagingCategoryKey(name: string): string {
  const key = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return key || 'CATEGORY';
}

export function getPackagingCategoryLabel(key: string): string {
  return PACKAGING_CATEGORY_LABELS[key as PackagingCategory] ?? humanizePackagingCategoryKey(key);
}

export const PACKAGING_UNIT_LABELS: Record<PackagingUnit, string> = {
  PIECE: 'Piece',
  ROLL: 'Roll',
  BOX: 'Box',
  METER: 'Meter',
};

export const PACKAGING_UNIT_SHORT_LABELS: Record<PackagingUnit, string> = {
  PIECE: 'pcs',
  ROLL: 'rolls',
  BOX: 'boxes',
  METER: 'm',
};

export const PACKAGING_UNIT_PLURAL_LABELS: Record<PackagingUnit, string> = {
  PIECE: 'pieces',
  ROLL: 'rolls',
  BOX: 'boxes',
  METER: 'meters',
};

export function getPackagingUnitLabel(unit: string): string {
  return PACKAGING_UNIT_LABELS[unit as PackagingUnit] ?? unit;
}

/** Compact unit suffix for number inputs, e.g. "1.6" + METER → "1.6 m". */
export function getPackagingUnitShortLabel(unit: string): string {
  return PACKAGING_UNIT_SHORT_LABELS[unit as PackagingUnit] ?? unit.toLowerCase();
}

/** Quantity with its unit, e.g. `formatPackagingQuantity(10, 'METER')` → "10 m". */
export function formatPackagingQuantity(quantity: number, unit: string): string {
  const suffix = getPackagingUnitShortLabel(unit);
  return suffix ? `${quantity} ${suffix}` : String(quantity);
}

/**
 * BUG-58 / M23-02: packaging list ordering contract.
 *
 * Postgres native enums sort by label declaration order (OID), NOT
 * alphabetically, so a DB-level `orderBy: { category: 'asc' }` does not
 * produce the pinned order. The list is small and unpaginated — sort
 * in-process against the category/name text instead.
 *
 * The frozen pin (`tests/23` §1.F6) asserts a non-decreasing **string**
 * comparison across the returned category list, so the contract is plain
 * alphabetical by category text, then by name.
 */
export function comparePackagingItems<T extends { category: string; name: string }>(
  a: T,
  b: T,
): number {
  if (a.category < b.category) return -1;
  if (a.category > b.category) return 1;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}
