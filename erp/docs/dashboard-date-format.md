# Dashboard date and time format (ARGUS #44)

`/dashboard` mixed three styles: `11:06 PM` in Recent Sales, `15 Nov 23:07` in
Recent Stock Movements, and `Fri, Nov 13` on the revenue chart.

## Rule

All dashboard timestamps now use one day-first, 24-hour style from
`src/lib/dashboard/dateFormat.ts`:

- timestamp: `15 Nov 2026, 23:07`
- chart x-axis day: `13 Nov`

The year is included in timestamps so an old stock movement is not mistaken for
a current one. Chart day keys (`YYYY-MM-DD`) are parsed by parts, so the label
cannot slip a day in timezones behind UTC.

## Files

- `src/lib/dashboard/dateFormat.ts`
- `src/components/dashboard/recentSaleTime.ts`
- `src/components/dashboard/RecentStockMovementsCard.tsx`
- `src/components/dashboard/charts/RevenueTrendChart.tsx`
