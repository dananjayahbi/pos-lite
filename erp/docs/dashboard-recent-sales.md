# Dashboard recent sales

## Date and time (ARGUS #40)

Rows outside today show the calendar day, so a list spanning two days no longer
looks out of order:

- today → `Today, 11:06 PM`
- yesterday → `Yesterday, 10:08 PM`
- older → `15 Nov, 10:08 PM`

`formatRecentSaleTimestamp()` in
`src/components/dashboard/recentSaleTime.ts` keeps the existing `en-LK` clock
format and compares local calendar days. Ordering and the 8-row limit are
unchanged.

## Payment label (ARGUS #41)

`resolveRecentSalePayment()` in
`src/components/dashboard/recentSalePayment.ts` resolves the label in this
order:

1. **Persisted payment legs** (only the needed `method`/`amount` fields are
   selected in the same Prisma query — no N+1). One method prints Cash / Card /
   LankaQR / Store Credit / Exchange Credit; multiple legs print e.g.
   `Cash + Card`.
2. **Legacy `Sale.paymentMethod`** when no legs exist (Cash, Card, …).
3. **Zero-value reason** for a zero-total sale with no legs:
   `BANK_PAYMENT` → **Bank payment**, `PRODUCT_REPLACEMENT` → Zero-value
   (replacement), `COMPLIMENTARY_GIFT` → Zero-value (complimentary), otherwise
   Zero-value. A genuine zero-value sale therefore never reads “NONE”.
4. A positive-total sale with no legs/tender prints **Unrecorded** so the data
   gap is visible instead of looking unpaid.

The label also carries a tone (cash/card/bank/qr/credit/split/zero/neutral) used
for the badge colour.
