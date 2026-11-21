# Report exports mirror the screen (ARGUS #441)

Export columns come from `src/lib/reports/report-config.ts`; the rows come from
`src/lib/reports/reportRows.ts`.

- Sales by Product exports Product, Variant, Units Sold, **Returned Qty**,
  **Net Units**, Gross Revenue, Returns, Net Revenue and % of Total, followed by
  the visible `Grand Total` row.
- Profit & Loss exports the statement rows with a `Margin %` column (gross and
  net), the COGS snapshot/current-cost split when it is shown on screen, the
  expense categories, and the monthly trend table with Revenue, COGS, Gross
  Profit, Expenses, Net Profit and Sales.
- The monthly trend section ends with `Total (selected period)`, summing the
  displayed month rows.
- `buildSalesExportRows()` and `buildProfitLossExportRows()` are pure, and
  `src/lib/reports/__tests__/reportRows.test.ts` asserts every registered column
  key appears in the exported rows, so a screen column cannot silently drop out
  of the file again.
