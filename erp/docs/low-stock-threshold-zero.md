# Low-stock definition and threshold 0 (ARGUS #215)

Screens disagreed on a variant with `lowStockThreshold = 0` and zero stock: the
Low Stock page, badge and adjustment notifications required a positive
threshold, while the Stock Control summary, dashboard KPI/table and inventory
valuation report counted `stockQuantity <= lowStockThreshold`, including 0/0.

## Decision

`lowStockThreshold = 0` means **alerting disabled**. A variant is low on stock
only when:

```text
lowStockThreshold > 0
AND stockQuantity <= lowStockThreshold
```

This matches the existing page/badge and adjustment-notification behaviour; the
summary, dashboard and valuation report were the outliers and now match.

`src/lib/inventory/lowStockPredicate.ts` is the single definition:

- `isLowStockVariant` for JS filters (valuation report and tests);
- `LOW_STOCK_SQL_PREDICATE` for the raw SQL in the low-stock API, Stock Control
  summary and dashboard queries (interpolated through `Prisma.raw`; it is a
  code constant, never user input).

An explicit threshold override still requires the variant to have alerting
enabled; an override cannot resurrect a 0-threshold variant. The Low Stock page
continues to list only enabled variants and its subtitle describes the applied
rule (ARGUS #214).

Tests: `src/lib/inventory/__tests__/lowStockPredicate.test.ts`.
