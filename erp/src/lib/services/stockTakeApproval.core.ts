/**
 * Stock-take approval math (ARGUS #138).
 *
 * A session stores `systemQuantity` (stock when the count started) and
 * `countedQuantity`. The stored `discrepancy` is correct for that moment, but
 * applying it at approval time is wrong when stock moved between the count and
 * the approval: the operator enters 48 against a snapshot of 48 while the shelf
 * system now says 50, and the drawer would stay at 50.
 *
 * Approval therefore compares the physical count with the CURRENT quantity and
 * applies that delta, so the variant ends at exactly what was counted.
 */

export interface StockTakeApprovalItem {
  variantId: string;
  countedQuantity: number | null;
  systemQuantity: number;
  discrepancy: number | null;
}

export interface StockTakeApprovalAdjustment {
  variantId: string;
  systemQuantity: number;
  countedQuantity: number;
  currentQuantity: number;
  /** countedQuantity - currentQuantity; what approval must apply. */
  quantityDelta: number;
}

export interface StockTakeApprovalPlan {
  adjustments: StockTakeApprovalAdjustment[];
  /** Variants that no longer exist; approval must not silently ignore them. */
  missingVariantIds: string[];
}

/**
 * Build the approval plan from the counted items and the current stock.
 *
 * Uncounted items are ignored (completion already refuses them); a counted item
 * whose current stock is unknown is reported instead of being adjusted by the
 * stale session discrepancy.
 */
export function computeStockTakeApprovalPlan(
  items: StockTakeApprovalItem[],
  currentQuantityFor: (variantId: string) => number | undefined,
): StockTakeApprovalPlan {
  const adjustments: StockTakeApprovalAdjustment[] = [];
  const missingVariantIds: string[] = [];

  for (const item of items) {
    if (item.countedQuantity === null) continue;

    const currentQuantity = currentQuantityFor(item.variantId);
    if (currentQuantity === undefined) {
      missingVariantIds.push(item.variantId);
      continue;
    }

    adjustments.push({
      variantId: item.variantId,
      systemQuantity: item.systemQuantity,
      countedQuantity: item.countedQuantity,
      currentQuantity,
      quantityDelta: item.countedQuantity - currentQuantity,
    });
  }

  return { adjustments, missingVariantIds };
}
