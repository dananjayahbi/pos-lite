# Valuation totals and category rows share one snapshot (ARGUS #220)

`api/store/stock-control/valuation` now builds the category breakdown first and
derives every KPI total from it with `sumValuationBreakdown()` in
`src/lib/pricing/valuationTotals.core.ts`.

- `retailValue`, `vatAmount`, `ssclAmount`, `taxAmount`, `retailValueInclTax`,
  `costValue` and `variantCount` are the column sums of the rendered rows.
- The category table shows a `Total` footer row and the CSV writes the same
  total row, so a reconciliation break is visible instead of silent.
- Per-category VAT/SSCL are included in each breakdown row (the UI only renders
  the combined Tax column).
- Raw-material value stays separate from the product valuation and is added only
  to `totalCostValue`, as before.
- `valuationTotals.core.test.ts` asserts the sums and the empty snapshot.
