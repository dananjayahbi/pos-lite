# Dashboard low-stock counter rule (ARGUS #49)

"Low Stock Alerts" and "Low Stock Variants" showed the same number today but
used different SQL:

- the KPI joined `products` and excluded archived/deleted products;
- the inventory snapshot counted `product_variants` only, so a low-stock
  variant belonging to an archived product inflated it.

## Shared rule

Both counters now use the same fragments from
`src/lib/inventory/lowStockPredicate.ts`:

- `LOW_STOCK_PRODUCT_SCOPE_SQL` - `p."isArchived" = false` and
  `p."deletedAt" IS NULL`;
- `LOW_STOCK_SQL_PREDICATE` - `lowStockThreshold > 0` and
  `stockQuantity <= lowStockThreshold`.

This is the rule already used by the Low Stock page and CSV export, so a
counter cannot drift from the list behind it.

## Files

- `src/lib/inventory/lowStockPredicate.ts`
- `src/app/(store)/dashboard/page.tsx`
- `src/app/api/store/stock-control/summary/route.ts`
