# Dashboard revenue uses the sale date (ARGUS #50)

Revenue KPIs and the 7-day charts selected and bucketed sales by
`completedAt`. That is the moment the till finished the transaction, not the
accounting date, so a backdated/missed sale was reported on the wrong day (or
outside the window entirely).

## Rule

The dashboard now uses the shared accounting-date rule in
`src/lib/reports/accounting.ts`:

- `saleDate` when the sale was recorded for a specific day;
- `createdAt` for rows created before `saleDate` existed.

Applied in two places:

- **KPIs** (`TodayStats` in `app/(store)/dashboard/page.tsx`) select today's
  sales with `saleAccountingDateWhere(startOfLocalDay(now), endOfLocalDay(now))`.
- **Charts** (`components/dashboard/AnalyticsSection.tsx`) select the 7-day
  window the same way, and `buildDailyRevenue()` buckets each sale on
  `effectiveSaleDate(sale)` instead of `completedAt`.

`Recent Sales` still orders by completion time because it is an activity feed,
not a revenue report.
