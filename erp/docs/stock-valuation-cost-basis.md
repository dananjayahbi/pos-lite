# Stock valuation is at current cost (ARGUS #218)

The Stock Valuation total cost is:

```text
sum(ProductVariant.costPrice * ProductVariant.stockQuantity)
+ sum(RawMaterial.quantity * RawMaterial.unitCost)
```

`costPrice` is the variant's current cost price, not the price actually paid
for the units currently on hand. Presenting the figure as plain "Total Cost
Value" implied an acquisition-cost valuation it does not calculate; editing a
variant's cost price silently restates the whole stock value.

## UI and export

`src/lib/pricing/valuationBasis.ts` owns the shared wording:

- `At current cost` qualifier on the Total Cost Value card and category
  column;
- a note: "Current cost price x stock on hand. Not historical acquisition cost.";
- the API returns `costBasis: "current-cost"` and `costBasisNote`;
- the CSV summary adds a `Cost Basis` row and labels the cost lines
  `Total Cost Value (At Current Cost)` / `Cost Value - At Current Cost`.

The Reports > Inventory Valuation page uses the same qualifier on its total and
column headings.

## Why no acquisition-cost figure

The data model does not support a faithful acquisition-cost valuation without a
schema/inventory-layer change:

- `ProductVariant.costPrice` is a single current value, not a layer.
- `SaleLine.costPriceSnapshot` is a cost snapshot for COGS, not the cost of
  remaining stock.
- `PurchaseOrderItem.expectedCostPrice` / `actualCostPrice` record receipt
  prices, but there is no per-batch/per-unit cost and no remaining-quantity
  layer; `BatchTracking` has quantity and expiry but no cost.
- `RawMaterial.unitCost` is likewise a current unit cost.

Deriving an acquisition value from those tables would require guessing which
receipts the current stock came from. Per the issue, the report keeps the
current accounting basis and states the limitation rather than inventing a
second number.

Tests: `src/lib/pricing/__tests__/valuationBasis.test.ts`.
