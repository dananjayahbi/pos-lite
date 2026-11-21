# Raw-material stock uses Decimal arithmetic and row locks

Manual raw-material adjustments and BOM consumption were read-modify-write
operations in JS floats. Concurrent adjustments could lose an update, two
production runs could both pass the stock check and drive a material negative,
and arithmetic could persist values such as `0.30000000000000004` (ARGUS #245).

## Quantity policy

`src/lib/services/rawMaterial.core.ts` owns the arithmetic:

- scale: **4 decimal places** (`RAW_MATERIAL_QUANTITY_SCALE`);
- rounding: **half-up** (`Decimal.ROUND_HALF_UP`);
- `roundRawMaterialQuantity(value)` normalises any input;
- `applyQuantityDeltaDecimal(current, delta)` adds/subtracts and refuses a
  negative result;
- `isRawMaterialQuantitySufficient(available, required)` compares at the scale;
- `consumeRawMaterialQuantity(available, required)` subtracts a consumption and
  returns the remaining Decimal.

The legacy number helper `applyQuantityDelta` now delegates to the Decimal one,
so existing callers get exact arithmetic too. BOM requirements
(`computeIngredientRequirement`, `computeConsumptionPlan`) multiply with Decimal
at the same scale.

## Locks

- **Manual adjustment** (`adjustRawMaterialStock`): inside the transaction it
  takes `SELECT ... FOR UPDATE` on the `raw_materials` row before reading the
  quantity, then writes the absolute Decimal result. The stored delta and
  before/after audit values are formatted at four decimals.
- **BOM production** (`produceGoods`): after building the plan it locks every
  consumed material id in sorted order (stable order, no deadlock), re-reads the
  committed quantities, re-runs the sufficiency check, and only then writes each
  absolute remaining quantity. The check and decrement now happen under the same
  locks.

A second concurrent run blocks on the row locks, sees the committed quantity and
fails with the existing `INSUFFICIENT_STOCK:name:required:available` error
instead of over-consuming.

No schema change was needed: `RawMaterial.quantity` and BOM quantities are
already Prisma `Decimal` columns.

## Verification

`src/lib/services/__tests__/rawMaterialQuantity.core.test.ts` covers the scale,
half-up rounding, float-noise-free addition/subtraction, the negative guard,
sufficiency at the boundary, consumption, and BOM requirement/plan precision.
The existing `rawMaterial.core.test.ts` and `bom.core.test.ts` suites still pass.
