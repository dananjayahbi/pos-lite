/**
 * One stock scope for every valuation surface (ARGUS #219).
 *
 * Stock Control's "Total Stock Value (Retail)", the Stock Valuation endpoint
 * and the Reports inventory valuation each carried their own filters: archived
 * products leaked into the dashboard card, soft-deleted products leaked into
 * the valuation endpoint. All three now quote this module.
 *
 * A variant counts only when it is not soft-deleted and its product is neither
 * soft-deleted nor archived. A deleted product is not sellable, and product
 * deletion cascades its variants, but legacy/live variants under a deleted
 * product must not reappear in a headline total.
 */

/** SQL predicate; expects the aliases `pv` (variant) and `p` (product). */
export const STOCK_SCOPE_SQL =
  'pv."deletedAt" IS NULL AND p."deletedAt" IS NULL AND p."isArchived" = false';

/** SQL predicate for the product side only; expects the alias `p`. */
export const STOCK_SCOPE_PRODUCT_SQL =
  'p."deletedAt" IS NULL AND p."isArchived" = false';

/** Prisma where-fragment for a `productVariant.findMany`/`count` scope. */
export const STOCK_SCOPE_PRISMA_WHERE = {
  deletedAt: null,
  product: { deletedAt: null, isArchived: false },
};

export interface StockScopeCandidate {
  variantDeletedAt?: Date | string | null;
  productDeletedAt?: Date | string | null;
  productIsArchived?: boolean | null;
}

/** JS mirror of `STOCK_SCOPE_SQL` for rows already loaded. */
export function isStockScopeVariant(candidate: StockScopeCandidate): boolean {
  return (
    (candidate.variantDeletedAt ?? null) === null &&
    (candidate.productDeletedAt ?? null) === null &&
    candidate.productIsArchived !== true
  );
}
