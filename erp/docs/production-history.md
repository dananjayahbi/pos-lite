# Production history (ARGUS #259)

The Factory Dashboard's production panel is a six-run summary. Before this
change it was the only production view: older runs and each run's actor, note,
batch and raw-material consumption could not be reached, and **Manage BOMs**
led to the recipe list, which has no history.

## Full log

`/factory/production` is a paginated (25 per page) production log gated by
`bom:production:view`. Each row shows product/SKU, recipe, quantity, material
cost, actor, batch and date; **Detail** expands the row with:

- the actor and the run note,
- the batch number, and
- the frozen recipe scaled by the produced quantity (per raw material, with
  unit labels).

The dashboard panel and the BOM list both link to it. No schema change was
needed:

- the batch number is read from the `PRODUCTION_LOGGED` audit after-payload
  (the `ProductionLog` model has no batch column),
- consumption is recomputed from the BOM recipe. A BOM cannot be edited after
  its first run (ARGUS #248), so the current recipe is the recipe the run used.

Pure helpers: `readProductionBatchNumber()` and
`scaleProductionConsumption()` in
`src/lib/services/productionHistory.core.ts`, tested in
`src/lib/services/__tests__/productionHistory.core.test.ts`. The list service
adds `bomName`, `batchNumber` and `consumption` to
`GET /api/store/bom/production` without changing its permission or pagination
contract.
