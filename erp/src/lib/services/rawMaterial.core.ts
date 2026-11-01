/**
 * Raw Material core — pure, framework-free helpers.
 *
 * Kept free of Prisma/DB so it can be unit-tested in isolation and reused by
 * the service layer, API routes, and UI for consistent labels and stock-status
 * logic.
 */
import type { RawMaterialCategory, Unit } from '@/generated/prisma/client';

export const RAW_MATERIAL_CATEGORY_LABELS: Record<RawMaterialCategory, string> = {
  OILS_LIQUIDS: 'Oils & Liquids',
  POWDERS_HERBS: 'Powders & Herbs',
  CHEMICALS: 'Chemicals',
};

export const UNIT_LABELS: Record<Unit, string> = {
  LITERS: 'Liters',
  KILOGRAMS: 'Kilograms',
  UNITS: 'Units',
};

export const UNIT_SHORT_LABELS: Record<Unit, string> = {
  LITERS: 'L',
  KILOGRAMS: 'kg',
  UNITS: 'unit',
};

export const RAW_MATERIAL_CATEGORIES = Object.keys(
  RAW_MATERIAL_CATEGORY_LABELS,
) as RawMaterialCategory[];

export const UNITS = Object.keys(UNIT_LABELS) as Unit[];

/**
 * Built-in categories seeded for every tenant. Tenants can create additional
 * categories; keys are unique per tenant and stay stable when the display name
 * is renamed.
 */
export const DEFAULT_RAW_MATERIAL_CATEGORIES: ReadonlyArray<{
  key: RawMaterialCategory;
  name: string;
}> = RAW_MATERIAL_CATEGORIES.map((key) => ({
  key,
  name: RAW_MATERIAL_CATEGORY_LABELS[key],
}));

/** Turn an arbitrary category key into a readable fallback label. */
export function humanizeRawMaterialCategoryKey(key: string): string {
  return key
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Derive a stable category key from a display name, e.g. "Bottles & Caps"
 * becomes "BOTTLES_CAPS". Falls back to "CATEGORY" when the name has no
 * alphanumeric characters.
 */
export function slugifyRawMaterialCategoryKey(name: string): string {
  const key = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return key || 'CATEGORY';
}

export function getRawMaterialCategoryLabel(category: string): string {
  return (
    RAW_MATERIAL_CATEGORY_LABELS[category as RawMaterialCategory] ??
    humanizeRawMaterialCategoryKey(category)
  );
}

export function getUnitLabel(unit: Unit): string {
  return UNIT_LABELS[unit] ?? unit;
}

export function getUnitShortLabel(unit: Unit): string {
  return UNIT_SHORT_LABELS[unit] ?? unit;
}

export type RawMaterialStockStatus = 'OUT' | 'LOW' | 'OK';

/**
 * Determine stock status for a raw material.
 * - `OUT` when quantity <= 0
 * - `LOW` when a positive threshold is set and quantity <= threshold
 * - `OK` otherwise
 */
export function getRawMaterialStockStatus(
  quantity: number,
  lowStockThreshold: number,
): RawMaterialStockStatus {
  if (quantity <= 0) {
    return 'OUT';
  }
  if (lowStockThreshold > 0 && quantity <= lowStockThreshold) {
    return 'LOW';
  }
  return 'OK';
}

export function isRawMaterialLowStock(quantity: number, lowStockThreshold: number): boolean {
  return getRawMaterialStockStatus(quantity, lowStockThreshold) !== 'OK';
}

/**
 * Ensure a raw-material quantity does not drop below zero. Returns the new
 * quantity or throws if the adjustment would produce a negative result.
 */
export function applyQuantityDelta(currentQuantity: number, delta: number): number {
  const next = currentQuantity + delta;
  if (next < 0) {
    throw new Error(
      `Insufficient stock: attempting to reduce by ${Math.abs(delta)} but only ${currentQuantity} available`,
    );
  }
  return next;
}
