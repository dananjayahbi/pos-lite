# Sales report: variant labels and unit counts

`/reports/sales` is grouped by **variant**, not product. The API already returns
`productName` and `variantDescription`; the chart now combines them:

```
Bhringraj Hair Oil - OIL / 100ml
Bhringraj Hair Oil - OIL / 500ml
```

`src/lib/reports/sales-report.ts` holds `salesProductLabel()` so the fallback
(no variant) is consistent and unit-testable.

## Units Sold vs Returned vs Net

`GET /api/reports/sales` now returns three unit fields per row:

| Field | Meaning |
| --- | --- |
| `unitsSold` | Units sold in the period (gross) |
| `returnedUnits` | Units returned in the period |
| `netUnits` | `unitsSold - returnedUnits` |

The table renders all three columns and the totals object carries
`totalUnits`, `totalReturnedUnits` and `totalNetUnits`. CSV/Excel exports include
the same fields, so a product with 3 sold and 1 returned shows `3 / 1 / 2`
instead of implying that all 3 units stayed with customers.

Returns remain a separate money column (`returns`) and are already netted from
`netRevenue`.

## Verification

- `src/lib/reports/__tests__/sales-report.test.ts`
- Existing report API suite: `tests/34_reports_analytics.spec.ts`.
