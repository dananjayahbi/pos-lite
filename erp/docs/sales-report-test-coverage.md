# Sales and P&L report test coverage (ARGUS #443)

`src/lib/reports/__tests__/report-consistency.test.ts` covers the rules the
helper-only suite missed:

- Sales by Product and P&L reconcile on the same sale: product gross
  (`subtotal - discountAmount`), refunds restated by the original cart-discount
  ratio, and the resulting net revenue are identical on both reports.
- Header-only / empty periods export no rows and allocate `0.00%` without a
  zero-total division.
- Missing cost snapshots set `usesFallback`, report 100% fallback and surface
  the caveat; complete snapshots stay quiet.
- The monthly table keeps only months inside the selected range and returns an
  empty list for a reversed range.
- `report:view:*` and `report:export` are separate capabilities, and the
  registered export columns include Returned Qty, Net Units and Margin %.
- The seeded 100.01% row set allocates to exactly 10,000 hundredths of a
  percent (100.00%).

Helpers touched: `accounting.ts`, `cogsSource.ts`, `monthlyPeriod.ts`,
`reportAccess.ts`, `reportRows.ts`, `sales-report.ts`.
