# Dashboard KPI icons

UI update #13 — the KPI cards on `/dashboard` rendered their icon at 20 px
(`h-5 w-5`) inside a 32 px tile (`rounded-lg p-2`). Next to the 24 px value text
the icon read as a faint decoration rather than a KPI marker.

## Change

Both KPI rows now use a 24 px icon in a 44 px tile:

- **Today stats** (`StatCard` in `app/(store)/dashboard/page.tsx`): Revenue,
  Sales, Customers and Low Stock icons are `h-6 w-6`; the tile is
  `rounded-xl p-2.5`.
- **Inventory snapshot** (`SummaryCard` in
  `components/dashboard/StockSummaryWidgets.tsx`): Catalog Products, Low Stock
  Variants, Pending Stock Takes and Inventory Retail Value use the same
  24 px / 44 px treatment.

The tile keeps `bg-linen text-terracotta`, so the larger icon stays on the brand
palette without changing the card layout, labels or values.

## Verification

`tests/50_dashboard_kpi_icons.spec.ts` logs in as the owner, waits for the
client-fetched inventory row, and for all eight KPI cards asserts:

- the card's icon SVG is at least 24 × 24 px;
- the icon tile is at least 40 × 40 px (the theme tile renders 44 × 44 at the
  default density).

## Files

- `src/app/(store)/dashboard/page.tsx`
- `src/components/dashboard/StockSummaryWidgets.tsx`
- `tests/50_dashboard_kpi_icons.spec.ts`
