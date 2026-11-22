# Opening stock and the stock ledger

Newly created product variants record their opening quantity as an
`INITIAL_STOCK` movement (ARGUS #139).

## Behaviour

`createProductVariants` (`src/lib/services/product.service.ts`) creates the
variants with `stockQuantity: 0`, then applies each normalised opening quantity
through `adjustStockInTx` inside the same transaction:

| Opening quantity | Result                                                        |
| ---------------- | ------------------------------------------------------------- |
| > 0              | One `INITIAL_STOCK` movement per variant (delta +qty)         |
| 0 / missing      | No movement; the variant simply starts empty                  |

`resolveOpeningStockQuantity` (`src/lib/services/openingStock.core.ts`)
normalises the form value: it prefers `initialStock`, falls back to
`stockQuantity`, and converts negative, fractional or non-finite input to a
safe integer. The movement records the creating user as `actorId` and the note
`Opening stock recorded on product creation`.

Because the update runs in the same transaction as the variant rows, a failure
leaves neither a variant without provenance nor a movement without a variant.

## Why

Writing the quantity straight onto `ProductVariant.stockQuantity` made stock
appear with no ledger entry: the first Stock History row for such a variant was
its first sale (e.g. 3 → 2), so the opening balance could not be explained.
Seeded products already had 24 `INITIAL_STOCK` rows; this path was the only one
missing.

## Verification

`src/lib/services/__tests__/openingStock.core.test.ts` covers the normalisation
(initialStock preference, fallback, zero, negative, fractional, NaN).

Out of scope: editing an existing variant's quantity in the product form still
writes `stockQuantity` directly; that is a separate ledger gap, not opening
stock.
