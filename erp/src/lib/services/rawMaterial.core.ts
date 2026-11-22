/**
 * Raw Material core — pure, framework-free helpers.
 *
 * Kept free of Prisma/DB so it can be unit-tested in isolation and reused by
 * the service layer, API routes, and UI for consistent labels and stock-status
 * logic.
 */
import Decimal from 'decimal.js';
import type { RawMaterialCategory } from '@/generated/prisma/client';

/**
 * Raw-material quantity arithmetic (ARGUS #245).
 *
 * Quantities are persisted as Prisma `Decimal`. Doing the arithmetic in JS
 * numbers first loses precision (`0.1 + 0.2 = 0.30000000000000004`). Every
 * manual adjustment and BOM consumption now uses these helpers, with one
 * explicit policy: four decimal places, round half-up. That resolves grams
 * (0.0001 kg) and matches the four-decimal `unitCost` column.
 */
export const RAW_MATERIAL_QUANTITY_SCALE = 4;
export const RAW_MATERIAL_QUANTITY_ROUNDING = Decimal.ROUND_HALF_UP;

type Decimalish = number | string | { toString(): string };

function quantityDecimal(value: Decimalish): Decimal {
  const parsed = new Decimal(value.toString());
  if (!parsed.isFinite()) {
    throw new Error('Quantity must be a finite number');
  }
  return parsed;
}

/** Round any quantity to the shared four-decimal scale. */
export function roundRawMaterialQuantity(value: Decimalish): Decimal {
  return quantityDecimal(value).toDecimalPlaces(
    RAW_MATERIAL_QUANTITY_SCALE,
    RAW_MATERIAL_QUANTITY_ROUNDING,
  );
}

/**
 * Apply a signed delta with Decimal arithmetic and refuse a negative result.
 * The returned value is already rounded to the shared scale.
 */
export function applyQuantityDeltaDecimal(
  currentQuantity: Decimalish,
  delta: Decimalish,
): Decimal {
  const roundedDelta = roundRawMaterialQuantity(delta);
  const next = roundRawMaterialQuantity(quantityDecimal(currentQuantity).plus(roundedDelta));
  if (next.isNegative()) {
    throw new Error(
      `Insufficient stock: attempting to reduce by ${roundedDelta.abs().toFixed(
        RAW_MATERIAL_QUANTITY_SCALE,
      )} but only ${roundRawMaterialQuantity(currentQuantity).toFixed(
        RAW_MATERIAL_QUANTITY_SCALE,
      )} available`,
    );
  }
  return next;
}

/** True when `available` covers `required` at the shared scale. */
export function isRawMaterialQuantitySufficient(
  available: Decimalish,
  required: Decimalish,
): boolean {
  return roundRawMaterialQuantity(available).greaterThanOrEqualTo(
    roundRawMaterialQuantity(required),
  );
}

/**
 * Subtract a required consumption amount, returning the remaining quantity.
 * The caller is expected to have checked `isRawMaterialQuantitySufficient`
 * under the same row lock; the negative guard is the final backstop.
 */
export function consumeRawMaterialQuantity(
  available: Decimalish,
  required: Decimalish,
): Decimal {
  return applyQuantityDeltaDecimal(available, roundRawMaterialQuantity(required).negated());
}

export const RAW_MATERIAL_CATEGORY_LABELS: Record<RawMaterialCategory, string> = {
  OILS_LIQUIDS: 'Oils & Liquids',
  POWDERS_HERBS: 'Powders & Herbs',
  CHEMICALS: 'Chemicals',
};

/**
 * Units of measure are tenant-managed rows (`RawMaterialUnit`). These built-in
 * defaults are seeded for every tenant; the maps below are only label fallbacks
 * for code that has not loaded the tenant's catalog yet.
 */
export const UNIT_LABELS: Record<string, string> = {
  LITERS: 'Liters',
  KILOGRAMS: 'Kilograms',
  UNITS: 'Units',
};

export const UNIT_SHORT_LABELS: Record<string, string> = {
  LITERS: 'L',
  KILOGRAMS: 'kg',
  UNITS: 'unit',
};

export const RAW_MATERIAL_CATEGORIES = Object.keys(
  RAW_MATERIAL_CATEGORY_LABELS,
) as RawMaterialCategory[];

export const UNITS = Object.keys(UNIT_LABELS);

/** Built-in units seeded for every tenant, mirroring the category defaults. */
export const DEFAULT_RAW_MATERIAL_UNITS: ReadonlyArray<{
  key: string;
  name: string;
  shortLabel: string;
}> = UNITS.map((key) => ({
  key,
  name: UNIT_LABELS[key]!,
  shortLabel: UNIT_SHORT_LABELS[key]!,
}));

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

/** Turn an arbitrary unit key into a readable fallback label. */
export function humanizeUnitKey(key: string): string {
  return humanizeRawMaterialCategoryKey(key);
}

export function getUnitLabel(unit: string): string {
  return UNIT_LABELS[unit] ?? humanizeUnitKey(unit);
}

export function getUnitShortLabel(unit: string): string {
  return UNIT_SHORT_LABELS[unit] ?? unit;
}

/**
 * ARGUS #247 - category/unit display names must be unique too.
 *
 * The category service only de-duplicated derived keys, so a tenant could add a
 * second "Powders & Herbs" (stored as `POWDERS_HERBS_2`) and the edit form then
 * offered two identical labels. Comparison is case/whitespace-insensitive.
 */
export function normalizeRawMaterialLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export interface RawMaterialLabelRow {
  id: string;
  name: string;
}

export function findDuplicateRawMaterialCategoryName(
  name: string,
  rows: readonly RawMaterialLabelRow[],
  excludeId?: string,
): RawMaterialLabelRow | null {
  const target = normalizeRawMaterialLabel(name);
  if (!target) return null;
  return (
    rows.find(
      (row) => row.id !== excludeId && normalizeRawMaterialLabel(row.name) === target,
    ) ?? null
  );
}

/**
 * ARGUS #247 - one option per display label.
 *
 * The select fallback prepended the material's current category/unit alongside
 * the fetched catalogue, and older data could hold two keys with the same name.
 * `preferKey` keeps the value the form is actually bound to.
 */
export function dedupeLabeledOptions<T extends { key: string; name: string }>(
  options: readonly T[],
  preferKey?: string,
): T[] {
  const ordered = preferKey
    ? [...options].sort((a, b) => {
        if (a.key === preferKey) return -1;
        if (b.key === preferKey) return 1;
        return 0;
      })
    : options;

  const seen = new Set<string>();
  const deduped: T[] = [];
  for (const option of ordered) {
    const label = normalizeRawMaterialLabel(option.name);
    if (seen.has(label)) continue;
    seen.add(label);
    deduped.push(option);
  }
  return deduped;
}

export type RawMaterialStockStatus = 'OUT' | 'LOW' | 'OK';

/** Every status the list filter accepts, in display order. */
export const RAW_MATERIAL_STOCK_STATUSES: readonly RawMaterialStockStatus[] = ['OK', 'LOW', 'OUT'];

/**
 * Normalize a `?stockStatus=` value. Unknown/missing values are ignored (the
 * route keeps its historical lenient behaviour instead of 400-ing).
 */
export function parseRawMaterialStockStatus(
  value: string | null | undefined,
): RawMaterialStockStatus | undefined {
  return value === 'OK' || value === 'LOW' || value === 'OUT' ? value : undefined;
}

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
 * ARGUS #242: the list filter and the status badge must share one rule. The
 * list uses this predicate to pick matching ids BEFORE pagination, so `total`,
 * `totalPages` and the page rows all describe the filtered set.
 */
export function matchesRawMaterialStockStatus(
  quantity: number,
  lowStockThreshold: number,
  status: RawMaterialStockStatus,
): boolean {
  return getRawMaterialStockStatus(quantity, lowStockThreshold) === status;
}

/**
 * Ensure a raw-material quantity does not drop below zero. Returns the new
 * quantity or throws if the adjustment would produce a negative result.
 */
export function applyQuantityDelta(currentQuantity: number, delta: number): number {
  // Kept for existing number-based callers/tests; the arithmetic is Decimal so
  // it cannot produce 0.30000000000000004 on the way to the caller.
  return applyQuantityDeltaDecimal(currentQuantity, delta).toNumber();
}
