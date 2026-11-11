/**
 * Packaging core — pure, framework-free helpers.
 *
 * Kept free of Prisma/DB so it can be unit-tested in isolation. The service
 * layer re-exports the deduction maths so dispatch and tests agree on the
 * same rounding contract.
 */
import Decimal from 'decimal.js';

import { getPackagingCategoryLabel, getPackagingUnitShortLabel } from '@/lib/constants/packaging';

/**
 * Whole units to take off an integer stock count for a decimal per-parcel
 * consumption. Rounds half-up (1.6 → 2, 0.5 → 1) and never takes less than one
 * unit when a consumption was configured, so a "0.5 label per parcel" item is
 * still tracked instead of silently deducting zero.
 */
export function packagingConsumptionUnits(perParcel: Decimal | number | string): number {
  const value = perParcel instanceof Decimal ? perParcel : new Decimal(perParcel);
  if (value.lessThanOrEqualTo(0)) return 0;
  const units = value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  return Decimal.max(units, 1).toNumber();
}

/**
 * Derive the human-readable SKU stem for a packaging item, e.g. "Bubble Wrap
 * 50m" in BUBBLE_WRAP becomes `BUBB-BUBBLE-WRAP-50M`.
 */
export function buildPackagingSkuBase(category: string, name: string): string {
  const categoryPart = category
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 4)
    .padEnd(2, 'X');
  const namePart = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
    .replace(/-+$/g, '');
  return `${categoryPart}-${namePart || 'ITEM'}`;
}

/** Pick the first free SKU in `base`, `base-2`, `base-3`, … */
export function nextAvailablePackagingSku(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

/** `quantity <= threshold` is the low-stock contract used by the table + notifications. */
export function isPackagingItemLowStock(
  quantityOnHand: number,
  lowStockThreshold: number,
): boolean {
  return quantityOnHand <= lowStockThreshold;
}

/** Category label for an item DTO, preferring the tenant's own category name. */
export function packagingCategoryLabel(key: string, nameMap?: Map<string, string>): string {
  return nameMap?.get(key) ?? getPackagingCategoryLabel(key);
}

/** Quantity + unit for UI text, e.g. "10 m" or "5 pcs". */
export function packagingQuantityLabel(quantity: number, unit: string): string {
  const suffix = getPackagingUnitShortLabel(unit);
  return suffix ? `${quantity} ${suffix}` : String(quantity);
}
