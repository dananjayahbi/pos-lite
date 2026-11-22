# Payroll export formatting (ARGUS #390)

Excel exports previously wrote money in General format, so the page/PDF value
`Rs 28,380.80` appeared as `28380.8` and `Rs 26,000.00` as `26000`.

- `src/lib/payroll/xlsx-money.core.ts` applies `#,##0.00` to every numeric money
  cell in the summary, bank worksheet and EPF/ETF workbooks (data and total
  rows).
- The summary workbook now carries the same `Headcount` control total shown in
  the PDF, and its Employees sheet ends with a `Total` row for every money
  column.
- The summary PDF employee-detail header uses the rate stored on the run
  (`EPF (9%)` when 9% was applied) instead of hard-coding 8%.
- Export column headers keep the ISO currency code `(LKR)`; the amounts are now
  two-decimal so they match the page's `Rs. 28,380.80` rendering.

Headcount remains a count and is deliberately left in General format.
