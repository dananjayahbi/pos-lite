# Concurrent purchase-order payments cannot overpay

A PO can be settled in instalments. Before ARGUS #231 the service read the
already-paid sum with the global Prisma client, outside the payment transaction,
and took no lock on the order. Two simultaneous payments could both read the
same sum, both pass the outstanding check, and both post a ledger credit.

## Fix

`payPurchaseOrder` (`src/lib/services/purchaseOrderPayment.service.ts`) now:

1. opens the payment transaction and takes `SELECT ... FOR UPDATE` on the PO row
   (same `lockForUpdate` helper as the goods-receipt path);
2. reads `PurchaseOrderPayment` totals through the transaction client, after
   the lock;
3. evaluates the request with
   `evaluatePurchaseOrderPayment(payable, paidTotal, requested)`.

The second caller blocks on the row lock, re-reads the committed payments, and
fails with 422 `VALIDATION_ERROR` instead of posting money.

## Guard

`evaluatePurchaseOrderPayment()` in
`src/lib/services/purchaseOrderPaymentGuard.core.ts` rejects:

| Rejection             | Rule                                         |
| --------------------- | -------------------------------------------- |
| `NOT_POSITIVE`        | requested amount is zero or negative         |
| `ALREADY_SETTLED`     | nothing outstanding (or payable is zero)     |
| `EXCEEDS_OUTSTANDING` | requested > `payable - paidTotal`            |

For every allowed request `newPaidTotal <= payable`, so the server enforces
"paid never exceeds total" even if a validation layer above it is bypassed.
Money is rounded half-up to cents with `decimal.js`.

The payment row, ledger entry, `paidAt` stamp and `PURCHASE_ORDER_PAID` audit row
still commit in the same transaction; only the settlement stamp moved to use the
locked total.

## Verification

`src/lib/services/__tests__/purchaseOrderPaymentGuard.core.test.ts` covers
instalments, exact settlement, a racing duplicate payment, overpayment,
non-positive amounts, zero payable, the paid-never-exceeds-payable invariant and
cent rounding.
