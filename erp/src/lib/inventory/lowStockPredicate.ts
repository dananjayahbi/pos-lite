/**
 * ARGUS #215 - one low-stock definition.
 *
 * A variant is low on stock only when alerts are enabled
 * (`lowStockThreshold > 0`) and the quantity has reached the threshold
 * (`stockQuantity <= lowStockThreshold`).
 *
 * `lowStockThreshold = 0` means **disabled**, not "alert only at absolute
 * zero". The Low Stock page, badge, manual-adjustment notifications, Stock
 * Control summary, dashboard KPI/table and inventory valuation report all use
 * this rule, so a 0/0 variant is not counted anywhere.
 */

export interface LowStockCandidate {
  stockQuantity: number;
  lowStockThreshold: number;
}

export function isLowStockVariant({ stockQuantity, lowStockThreshold }: LowStockCandidate): boolean {
  if (!Number.isFinite(stockQuantity) || !Number.isFinite(lowStockThreshold)) {
    return false;
  }
  return lowStockThreshold > 0 && stockQuantity <= lowStockThreshold;
}

/** SQL fragment shared by the summary/dashboard queries (alias `pv`). */
export const LOW_STOCK_SQL_PREDICATE =
  'pv."lowStockThreshold" > 0 AND pv."stockQuantity" <= pv."lowStockThreshold"';

/**
 * ARGUS #49 - product scope shared by every low-stock counter.
 *
 * Archived or soft-deleted products are not sellable, so their variants must
 * not inflate a low-stock counter. The Low Stock page has always applied this
 * scope; the dashboard KPI and the inventory snapshot now quote this constant
 * instead of each carrying their own copy.
 */
export const LOW_STOCK_PRODUCT_SCOPE_SQL =
  'p."isArchived" = false AND p."deletedAt" IS NULL';
