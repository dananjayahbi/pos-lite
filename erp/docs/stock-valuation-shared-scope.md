# One stock scope for valuation surfaces (ARGUS #219)

`src/lib/inventory/stockScope.ts` is the single definition of which variants a
stock valuation may count:

- variant `deletedAt IS NULL`
- product `deletedAt IS NULL`
- product `isArchived = false`

It exports `STOCK_SCOPE_SQL` (raw queries with aliases `pv` and `p`),
`STOCK_SCOPE_PRISMA_WHERE` (Prisma queries) and `isStockScopeVariant()` for
rows already loaded.

Consumers:

| Surface | File |
| --- | --- |
| Stock Control dashboard card, "Total Stock Value (Retail)" | `api/store/stock-control/summary/route.ts` |
| Stock Valuation page / endpoint | `api/store/stock-control/valuation/route.ts` |
| Reports inventory valuation | `api/reports/inventory-valuation/route.ts` |

Before this, the dashboard card skipped the product join entirely, so archiving
a stocked product split the two headline totals. The dashboard SQL now joins
products and applies the shared predicate; the valuation endpoint also dropped
soft-deleted products.
