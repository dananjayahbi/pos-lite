# Return refunds include tax

A return refunds the tax that was actually collected on the returned goods
(ARGUS #90). Previously the refund was computed from `lineTotalAfterDiscount`
only, so every taxable return was short by its tax: a 2,084.00 line with 375.12
VAT refunded 2,084.00 against a 2,459.12 sale.

The refund is also based on the **paid** value, not the list value: the sale's
cart-level discount (manual + promotions) is apportioned across the lines
(ARGUS #91), so a fully discounted zero-value sale refunds zero instead of its
list price.

## Where the tax comes from

`SaleLine.lineTax` now snapshots the tax charged on each line (the amount
`createSale` already computed but discarded). `computeReturnRefund()` in
`src/lib/services/returnRefund.core.ts` uses it:

```
paid line base = lineTotalAfterDiscount − allocated cart discount
line refund    = (returnQty / soldQty) × (paid line base + lineTax)
```

The discount allocation is the same `allocateCartDiscountShares` call
`createSale` used, and the goods and tax parts are rounded separately, so
`Return.taxAmount` is the exact sum of the per-line tax refunds. A full return
therefore refunds `subtotal − discountAmount + taxAmount` (delivery excluded),
which is exactly what the customer paid.

## Legacy sales

Sales recorded before the column existed have `lineTax = 0`. For those rows the
sale-level `taxAmount` is apportioned across the lines — by recorded line tax
when some lines have it, otherwise by the post-discount paid line total — with
the rounding remainder placed on the largest line so the shares sum exactly.
This recovers the reported 2,459.12 refund for historical CMVP6Q23 / CMWGA2GB
sales.

## Delivery charge policy

Delivery is **not refunded**. It covers a service already rendered for the
original sale and is not part of the returned goods. In the CMWGA2GB example
(2,084 goods + 375.12 VAT + 475 delivery) the refund is 2,459.12.

## What is stored and shown

| Field                         | Meaning                               |
| ----------------------------- | ------------------------------------- |
| `SaleLine.lineTax`            | Tax charged on the line at sale time  |
| `Return.refundAmount`         | Total refund, tax included            |
| `Return.taxAmount`            | Tax component of `refundAmount`       |
| `ReturnLine.lineRefundAmount` | Total refund for the line (incl. tax) |
| `ReturnLine.lineTaxAmount`    | Tax component of the line refund      |

The POS return wizard previews the same figure by calling the shared pure
function, and the printed return receipt shows **Tax refunded** and **Original
sale total** alongside **Total Refund**.

## Verification

`src/lib/services/__tests__/returnRefund.core.test.ts` covers the reported
sales, partial-quantity returns, mixed VAT/exempt lines, legacy apportioning,
rounding, zero-value (fully discounted) sales, cart-discount allocation and the
"never more than the sale total" invariant; the return-receipt tests cover the
new receipt rows.
