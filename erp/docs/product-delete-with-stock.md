# Deleting a product with stock

Soft-deleting a product that still holds stock is refused (ARGUS #137). The
delete sets `deletedAt` on the product and its variants, which removes them from
inventory, low-stock and valuation views — previously without any stock movement,
silently writing the units off the balance sheet (37 deleted products held 412
units, retail Rs. 496,816).

## Behaviour

`softDeleteProduct` sums the live variants' `stockQuantity` and calls
`assertProductHasNoStock` (`src/lib/services/productDelete.core.ts`):

| Stock on hand | Result                                                    |
| ------------- | --------------------------------------------------------- |
| 0             | Soft delete proceeds (restorable from the Deleted filter) |
| > 0           | `409 PRODUCT_HAS_STOCK` naming the unit count             |

The operator must either:

- adjust the stock to zero through Stock Control (an explicit, audited
  write-off movement), or
- archive the product (it leaves the POS/storefront but stays in stock reports).

The delete dialogs in Inventory and on the product detail page explain this and
surface the API message when the delete is refused.

## Legacy rows

Products deleted before this guard remain soft-deleted with their stock; no
movement records the loss. Correcting them requires an explicit data fix or a
stock adjustment after restoring them.

## Verification

`src/lib/services/__tests__/productDelete.core.test.ts` covers zero stock, the
blocked case with the unit count, and singular wording.
