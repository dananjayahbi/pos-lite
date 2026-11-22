# P&L monthly detail follows the selected period (ARGUS #437)

The "Monthly Gross Profit (Last 12 Months)" table ran from server
`NOW() - INTERVAL '12 months'` regardless of the From/To date picker. A
September-only P&L therefore displayed August-November alongside a September
statement total.

## Rule

All five monthly queries (revenue, COGS, returns, returned COGS, expenses) now
use the same `from`/`to` bounds as the statement totals. The merged rows are
then filtered with `filterMonthKeysInPeriod` from
`src/lib/reports/monthlyPeriod.ts` so an out-of-period month can never leak
back into the table.

The section is labelled **Monthly Gross Profit (Selected Period)**; it is no
longer presented as a trailing 12-month trend.

## Verification

`src/lib/reports/__tests__/monthlyPeriod.test.ts` covers:
- local `YYYY-MM` keys;
- a September-only period dropping Aug/Oct/Nov;
- a multi-month period keeping and sorting every row;
- an empty result when no month matches.

## Residual

The monthly chart still groups by the database session timezone. This task fixes
the period scope, not month-boundary timezone conversion for individual sales.
