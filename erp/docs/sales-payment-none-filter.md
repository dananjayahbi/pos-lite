# Sales payment filter includes NONE (ARGUS #89)

Zero-value sales are stored with `PaymentMethod.NONE`, but the Sales filter
offered only CASH/CARD/LANKAQR/SPLIT/store/exchange credit, so they could not be
isolated. The list badge also printed the raw enum (`NONE`).

- The payment select now includes **None**. It is sent as `paymentMethod=NONE`,
  which the list API already validates against the Prisma enum and applies
  server-side before pagination.
- `src/lib/sales/payment-method-label.ts` is the single label map used by the
  list badge and the detail modal: `NONE -> None`, `STORE_CREDIT -> Store
  Credit`, `EXCHANGE_CREDIT -> Exchange Credit`, etc.
- The list badge gives `NONE` a neutral grey style so it reads as "no tender"
  rather than a missing value.

Tests: `src/lib/sales/__tests__/payment-method-label.test.ts`.
