# Sales report percentages and the Top-10 chart (ARGUS #439)

The Sales by Product report displays `% of Total` per variant and a footer total.
Both come from `allocatePercentOfTotal()` in `src/lib/reports/sales-report.ts`.

- Percentages are allocated with the largest-remainder method in hundredths of
  a percent, so the displayed rows always add up to the displayed total
  (`100.00` for a positive total). Independent `toFixed(2)` rounding used to
  produce `100.01` beside a hardcoded `100%` footer.
- Rows with zero net revenue keep `0.00` and stay in the table, so the exported
  file still lists them.
- A negative or zero net total has no meaningful percentage split; those rows
  use plain rounding and the footer shows the sum of the displayed values.
- `totals.pctOfTotal` in the API envelope is the reconciled footer value; the
  client falls back to summing the rows for older payloads.
- The Top 10 chart uses `topRevenueProducts()`, which drops zero/negative
  net-revenue rows before taking the first ten bars.
