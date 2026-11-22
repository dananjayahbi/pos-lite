/**
 * Helpers for computing cart totals and formatting them for display.
 */

import { formatLKR } from '@/lib/utils';
import type { CartLine } from '@/stores/cartStore';

export interface CartTotals {
  itemCount: number;
  subtotal: number;
  formattedSubtotal: string;
  /** True when every line has stock > its quantity. */
  allInStock: boolean;
}

export function computeCartTotals(lines: CartLine[]): CartTotals {
  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.price, 0);
  const allInStock = lines.every((l) => l.maxStock >= l.quantity);
  return {
    itemCount,
    subtotal,
    formattedSubtotal: formatLKR(subtotal),
    allInStock,
  };
}

/**
 * ARGUS #287 — the storefront has no per-unit weight in the catalogue, so the
 * checkout collects the parcel weight. Normalize the raw input to a positive kg
 * value with the rate card's 2dp precision, or `undefined` when unknown (the
 * ERP then falls back to the base rate and records the gap in its audit log).
 */
export function parseParcelWeightKg(
  value: string | number | null | undefined,
): number | undefined {
  if (value === null || value === undefined) return undefined;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}