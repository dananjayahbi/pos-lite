import { ApiError } from '@/lib/api/errors';
import { getPackagingUnitShortLabel } from '@/lib/constants/packaging';
import { packagingItemHasStock } from '@/lib/services/packaging.core';

/**
 * ARGUS #280 — packaging stock may only move through the adjustment path.
 *
 * A PATCH edit used to accept `quantityOnHand` directly (no reason/note in the
 * audit), and DELETE soft-hid an item while it still held stock, leaving those
 * units unaccounted. Stock is now adjusted only by `adjustPackagingStock`, and
 * deletion is refused until the item is empty.
 */

/** True when an update payload tries to set stock directly. */
export function packagingUpdateTouchesStock(payload: unknown): boolean {
  return (
    !!payload &&
    typeof payload === 'object' &&
    Object.prototype.hasOwnProperty.call(payload, 'quantityOnHand')
  );
}

export interface PackagingDeleteGuardInput {
  quantityOnHand: number;
  /** Unit key, used only to make the message actionable. */
  unit?: string | undefined;
}

export function assertPackagingItemDeletable(input: PackagingDeleteGuardInput): void {
  if (!packagingItemHasStock(input.quantityOnHand)) return;

  const suffix = input.unit ? getPackagingUnitShortLabel(input.unit) : '';
  throw new ApiError(
    409,
    'PACKAGING_HAS_STOCK',
    `This packaging item still has ${formatQuantity(input.quantityOnHand)}${suffix ? ` ${suffix}` : ''} on hand. Adjust the stock to zero (write-off) before deleting it.`,
  );
}

/** Trim trailing zeros so messages read "10" and "2.5", not "10.000". */
function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}
