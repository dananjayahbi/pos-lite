# Shift and Z-report formatting + net revenue (ARGUS #117)

## One date convention

`formatShiftDateTime()` (`src/lib/shifts/shift-format.ts`) renders
`en-GB` day-first medium date + short time: **14 Nov 2026, 20:24**.

It replaces `en-LK` on `/staff/shifts` and `/staff/shifts/[id]` and `en-US` on
`/pos/shift-report`, so a shift opened at the same instant reads identically in
the ledger, the detail page and the printed report. Sales/returns already used
`en-GB`; receipts keep DD/MM/YYYY (also day-first). Invalid/missing values
render `-`.

## One money sign convention

`formatShiftRupee()` puts the sign before the currency symbol:

| Value | Output |
| --- | --- |
| `-2978` | `-Rs. 2,978.00` (was `Rs. -2,978.00`) |
| `2978` | `Rs. 2,978.00` |
| `2978`, `{ sign: 'always' }` | `+Rs. 2,978.00` |

Used for the recorded cash difference (ledger + detail) and the Z-report
**Difference** row.

## Net Revenue on one tax basis

The old `netRevenue = totalSalesAmount - totalRefundAmount` mixed bases: sales
are tax-inclusive, while a refund total can be pre-tax. `netRevenueOnSameTaxBasis()`
(`src/lib/shifts/z-report-net-revenue.ts`) reduces both sides to goods value:

```
net = (sales - salesTax) - (refund - refundTax)
```

`buildZReportData()` now sums `Sale.taxAmount` and the attributed
`Return.taxAmount` (legacy returns carry 0 and a goods-only refund, which lands
on the same basis). The Z-report caption reads **Sales − Returns (excl. tax)**.

## Verification

`src/lib/shifts/__tests__/shift-format.test.ts` covers day-first output, dashes
and signed money; `z-report-net-revenue.test.ts` covers the reported
46,941.26 / 3,371.60 case, tax-inclusive refunds, rounding and negative net.
