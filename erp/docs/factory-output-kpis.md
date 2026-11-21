# Factory output KPIs (ARGUS #261)

The Factory Dashboard used to summarise only raw-material input stock. The
production runs and units produced lived only in the six-row history panel, the
batch count only in the Batches module, and finished-goods stock/value only on
the product pages.

## New cards

A second KPI row (visible to anyone with `factory:dashboard:view`) shows:

| Card | Source |
| --- | --- |
| Production runs | `ProductionLog` count for the tenant |
| Units produced | `sum(ProductionLog.quantity)` |
| Finished goods | `sum(stockQuantity)` for active MANUFACTURED variants |
| Finished-goods value | `sum(stockQuantity × costPrice)`, 2 decimals |

Raw-material cost consumed across runs and average units per run are returned by
the API for future use, but are not headline cards.

## API

`GET /api/store/factory/stats` — authenticated, tenant-scoped, requires
`factory:dashboard:view`. Returns `{ productionRunCount, totalProduced,
totalMaterialCost, averageUnitsPerRun, finishedGoodsUnits, finishedGoodsValue,
lastProductionAt }`.

The pure summariser is `summarizeFactoryOutput()` in
`src/lib/factory/factoryOutputStats.core.ts` (non-finite/negative inputs are
treated as zero so a KPI can never render a negative). The dashboard refetches
the new `factory-output-stats` query with the other factory feeds.
