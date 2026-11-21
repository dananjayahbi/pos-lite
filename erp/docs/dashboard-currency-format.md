# Dashboard money format (ARGUS #43)

The dashboard used two currency styles: `Intl.NumberFormat('en-LK', { currency:
'LKR' })` printed `LKR 0.00` in chart tooltips, while the KPI and recent-sales
amounts printed `Rs. 1,137,909.60` through `formatRupee()`.

## Rule

Every money value on `/dashboard` now goes through `formatRupee()` from
`src/lib/format.ts`, which is the dominant style in the store UI:

- `Today's Revenue`
- each `Recent Sales` amount
- the `Revenue Trend`, `Sales by Payment` and `Top Products` tooltips

Chart axis ticks still use compact `k` numbers (for example `12k`); they carry
no currency symbol, so they cannot contradict the money style.

## Files

- `src/app/(store)/dashboard/page.tsx`
- `src/components/dashboard/charts/RevenueTrendChart.tsx`
- `src/components/dashboard/charts/SalesByPaymentChart.tsx`
- `src/components/dashboard/charts/TopProductsChart.tsx`
