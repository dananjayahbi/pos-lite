# Raw-material costing

Raw materials were a quantity-only counter: no unit cost, no stock value, no
material cost on production logs and no appearance in inventory valuation
(ARGUS #243).

## Data

Migration `20261121160000_raw_material_costing` adds:

| Table             | Column         | Meaning                                   |
| ----------------- | -------------- | ----------------------------------------- |
| `raw_materials`   | `unitCost`     | cost of one base unit (4dp)               |
| `production_logs` | `materialCost` | value consumed by that production run (2dp) |

## Behaviour

- The raw-material form has **Cost per unit (Rs)** (editable, not a stock
  movement) and shows the resulting **Stock value** on edit.
- `computeRawMaterialStockValue(quantity, unitCost)` values on-hand stock;
  `computeMaterialCost(consumption)` values a production run. Both are pure and
  tested in `rawMaterialValuation.core.ts`.
- `produceGoods` snapshots the consumed value into `ProductionLog.materialCost`
  (consumption line `required` x the raw material's unit cost at production
  time), so finished-goods COGS stays explainable even if the material cost
  later changes. The production history shows a Material cost column.
- The stock valuation API adds raw-material value to the report:
  `rawMaterialValue`, `rawMaterialCount` and `totalCostValue` (products + raw
  materials). The CSV includes both lines; the valuation page shows the split
  under Total Cost Value.

## Scope / limitations

Raw materials are still not purchasable through a purchase order (POs carry
product variants only), so `unitCost` is maintained on the material rather than
derived from a GRN. When raw-material receipts are added to purchasing, the
receipt's actual cost should update this field. Unit changes remain blocked while
stock is on hand because no conversion factor exists.
