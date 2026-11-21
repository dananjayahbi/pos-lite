import { ApiError } from '@/lib/api/errors';

/**
 * Refuse to soft-delete a product that still holds stock.
 *
 * A soft delete removes the product and its variants from inventory, low-stock
 * and valuation views without writing a stock movement, so the units would
 * silently disappear from the balance sheet (ARGUS #137). The operator must
 * adjust the stock to zero (an explicit write-off) or archive the product.
 */
export function assertProductHasNoStock(unitsOnHand: number): void {
  if (unitsOnHand > 0) {
    throw new ApiError(
      409,
      'PRODUCT_HAS_STOCK',
      `This product still has ${unitsOnHand} unit${unitsOnHand === 1 ? '' : 's'} in stock. Adjust the stock to zero or archive the product before deleting it.`,
    );
  }
}
