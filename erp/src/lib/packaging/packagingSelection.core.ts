/**
 * Per-dispatch packaging selection (ARGUS #283).
 *
 * An `autoDeduct` flag used to mean "this item is consumed on EVERY parcel,
 * regardless of what is in the order". The dispatch sheet now lets the operator
 * confirm/edit the packaging used for this delivery, with auto-deduct items as
 * the default suggestion. These helpers keep the default, the toggle and the
 * visible total pure and testable.
 */

export interface PackagingSelectionOption {
  id: string;
  name: string;
  autoDeduct: boolean;
  /** Configured decimal per-parcel rate (string from the API). */
  consumptionPerParcel: string | number | null;
}

/** Default selection: every auto-deduct item (the pre-#283 behaviour as a suggestion). */
export function suggestedPackagingItemIds(options: PackagingSelectionOption[]): string[] {
  return options.filter((option) => option.autoDeduct).map((option) => option.id);
}

/** Add/remove one item while preserving the option order. */
export function togglePackagingItemId(
  selectedIds: string[],
  itemId: string,
  options: PackagingSelectionOption[],
): string[] {
  const next = selectedIds.includes(itemId)
    ? selectedIds.filter((id) => id !== itemId)
    : [...selectedIds, itemId];
  const order = new Map(options.map((option, index) => [option.id, index]));
  return next.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}

export interface PackagingSelectionTotals {
  selectedCount: number;
  /** Sum of the configured per-parcel rates for the selected items. */
  unitsPerParcel: number;
}

/** Visible "what this parcel will consume" total (configured rates, not stock). */
export function packagingSelectionTotals(
  options: PackagingSelectionOption[],
  selectedIds: string[],
): PackagingSelectionTotals {
  const selected = new Set(selectedIds);
  const unitsPerParcel = options
    .filter((option) => selected.has(option.id))
    .reduce((sum, option) => sum + Number(option.consumptionPerParcel ?? 1), 0);

  return {
    selectedCount: options.filter((option) => selected.has(option.id)).length,
    unitsPerParcel: Number(unitsPerParcel.toFixed(2)),
  };
}
