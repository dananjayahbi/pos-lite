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
};

export const UNIT_SHORT_LABELS: Record<Unit, string> = {
  LITERS: 'L',
  KILOGRAMS: 'kg',
};

export const RAW_MATERIAL_CATEGORIES = Object.keys(
  RAW_MATERIAL_CATEGORY_LABELS,
) as RawMaterialCategory[];

export const UNITS = Object.keys(UNIT_LABELS) as Unit[];

export function getRawMaterialCategoryLabel(category: RawMaterialCategory): string {
  return RAW_MATERIAL_CATEGORY_LABELS[category] ?? category;
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
