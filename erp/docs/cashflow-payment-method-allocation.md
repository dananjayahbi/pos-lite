# Payment-method allocation (ARGUS #419)

The Cash Flow page listed payment-method totals beside Gross Sales but never
reconciled them. On live data the methods summed Rs 10,000 short: four completed
Rs 2,500 cash sales had no `Payment` rows, and nothing on the page said so.

## Rule

`reconcilePaymentMethods` in `src/lib/services/cashflow.core.ts` compares the
sum of `Payment` rows for completed sales in the window with Gross Sales:

```
allocated    = sum(payment.method totals)
unallocated  = grossSales - allocated
status       = BALANCED | UNALLOCATED | OVERALLOCATED
```

The service also counts completed, non-zero sales in the window with no payment
rows (`payments: { none: {} }`) so the warning can name the affected sales.

## UI

The Income card now always renders the method allocation with an explicit
**Unallocated / no payment record** line and a **Method total + unallocated**
row that equals Gross Sales. When the status is not `BALANCED`, a warning names
the shortfall and the number and value of completed sales with no payment rows.
An over-allocation (payment rows above Gross Sales) is called out separately.

The line is server-computed; the client only formats it.

## Verification

`cashflow.core.test.ts` covers the Rs 10,000 shortfall, a balanced split and an
over-allocated split.
