# Bulk price update validation

Bulk price updates now enforce the catalogue invariants the product/variant
forms already enforce (ARGUS #140).

## Rules

`computeBulkVariantPrice()` (`src/lib/services/bulkPrice.core.ts`) computes the
prospective cost/retail prices and rejects a variant when:

- either price would be **zero or negative** (a 150% decrease used to write
  -1,383.20 for a 2,766.40 retail price);
- **retail would be below cost** (fixed mode could set that; percentage cost
  increases can too).

Each variant is evaluated individually, so one invalid row does not block the
valid ones. The response reports `{ updated, errors, rejected, rejections }`,
where `rejections` lists `{ variantId, productId, reason }` with reason
`NON_POSITIVE_PRICE` or `RETAIL_BELOW_COST`.

Rounding stays at 2 decimal places, and a retail price exactly equal to cost is
allowed (the forms allow that boundary).

## Verification

`src/lib/services/__tests__/bulkPrice.core.test.ts` covers normal increases,
negative/zero results, fixed retail-below-cost, percentage cost overtaking
retail, 2dp rounding and the equality boundary.
