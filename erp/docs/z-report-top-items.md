# Z-report top items (ARGUS #112)

## Problem

The open shift showed top-items revenue of Rs 27,588.96 against Rs 14,026.22 of
completed sales (+97%). The aggregation summed `SaleLine.lineTotalAfterDiscount`
— the price after line discounts but **before the cart-level discount** — so a
promotion or a zero-value bank sale was reported at list price. This is the same
attribution bug already fixed for the dashboard's Sales by Product.

## Definition

Top-items revenue is the money collected for each line:

```
collected = lineTotalAfterDiscount − line's share of Sale.discountAmount
```

`Sale.discountAmount` is the combined manual cart discount + promotions, and the
share is computed with `allocateCartDiscountShares` (the same allocation the POS
applies before tax and the dashboard uses), so the lines sum to the discounted
subtotal, not the pre-discount total. Fully discounted/zero-value lines therefore
report `0` revenue (their quantity is still counted).

Only `COMPLETED` sales contribute: `OPEN` (held) and `VOIDED` rows are excluded,
both by the query and defensively in the helper, so the report cannot disagree
with the Z-report's completed-sales total again.

Tax and delivery remain sale-level and are not attributed to products, matching
the dashboard's Sales by Product definition.

## Implementation

`src/lib/shifts/z-report-top-items.ts` (pure, unit tested):

```ts
buildZReportTopItems(sales, limit = 10)
  // per sale: allocateCartDiscountShares(lineTotals, discountAmount)
  // revenue  = lineTotal − share  (floored at 0)
  // groups by product + variant, sorted by quantity
```

`buildZReportData` now selects only the line fields it needs
(`productNameSnapshot`, `variantDescriptionSnapshot`, `quantity`,
`lineTotalAfterDiscount`) plus `status`, `totalAmount`, `discountAmount` and
`payments`, and delegates aggregation to the helper. Query remains scoped to the
shift and `COMPLETED` status.
