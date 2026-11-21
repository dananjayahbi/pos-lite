import { ApiError } from '@/lib/api/errors';

/**
 * ARGUS #241 — raw-material edit/delete must not move stock.
 *
 * A soft delete hides the row from the list, stats and valuation without
 * writing any stock movement, so any units still on hand would silently vanish
 * from the books (the same defect class as ARGUS #137 on products). Likewise a
 * unit change reinterprets the stored absolute quantity without a conversion
 * factor ("17 kg" becoming "17 L"). Both operations are refused while stock is
 * on hand; the operator must write the stock off through the adjustment
 * workflow first.
 */

export interface RawMaterialDeleteGuardInput {
  quantityOnHand: number;
  /** `BillOfMaterialsItem` rows belonging to active (non-deleted) BOMs. */
  activeBomCount: number;
}

export function assertRawMaterialDeletable(input: RawMaterialDeleteGuardInput): void {
  if (input.quantityOnHand > 0) {
    const units = formatQuantity(input.quantityOnHand);
    throw new ApiError(
      409,
      'RAW_MATERIAL_HAS_STOCK',
      `This raw material still has ${units} on hand. Adjust the stock to zero (write-off) before deleting it.`,
    );
  }

  if (input.activeBomCount > 0) {
    throw new ApiError(
      409,
      'RAW_MATERIAL_IN_BOM',
      `This raw material is used by ${input.activeBomCount} active bill${input.activeBomCount === 1 ? '' : 's'} of materials. Remove it from ${input.activeBomCount === 1 ? 'that recipe' : 'those recipes'} before deleting it.`,
    );
  }
}

export interface RawMaterialUnitChangeGuardInput {
  currentUnit: string;
  nextUnit: string;
  quantityOnHand: number;
}

export function assertRawMaterialUnitChangeAllowed(input: RawMaterialUnitChangeGuardInput): void {
  if (input.nextUnit === input.currentUnit) return;
  if (input.quantityOnHand <= 0) return;

  throw new ApiError(
    409,
    'RAW_MATERIAL_UNIT_HAS_STOCK',
    `This raw material still has ${formatQuantity(input.quantityOnHand)} on hand. A stored quantity cannot be converted between units automatically - adjust the stock to zero first, change the unit, then add the stock back in the new unit.`,
  );
}

/** Trim trailing zeros so messages read "42" and "2.5", not "42.000". */
function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}
