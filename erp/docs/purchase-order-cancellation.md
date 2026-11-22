# Purchase-order cancellation is only offered when it can succeed

`cancelPO` (`src/lib/services/purchaseOrder.service.ts`) only accepts a `DRAFT`
or `SENT` order. Received goods have already created stock movements and
per-line received quantities, so there is no cancel-short path: the corrective
action is a return or a new order.

## Rule

`canCancelPurchaseOrder(status)` (`src/lib/services/purchaseOrderPermissions.core.ts`):

| Status               | Cancel offered |
| -------------------- | -------------- |
| `DRAFT`              | Yes            |
| `SENT`               | Yes            |
| `PARTIALLY_RECEIVED` | No             |
| `RECEIVED`           | No             |
| `CANCELLED`          | No             |

Money is a separate lock. `isPurchaseOrderFinanciallyLocked(paidTotal)` refuses
a cancel after any payment has been recorded, so the detail page composes both
helpers. The list can rely on the status helper alone because the payment API
only pays a received order, which is never cancellable by status.

## Why it changed

The list and detail used to show **Cancel PO** for `PARTIALLY_RECEIVED` orders.
Every click hit `cancelPO`, which rejects the transition and returns 409. The
action is now hidden in the list, replaced by a disabled
"Cancel unavailable - goods received" item. The detail page shows a disabled
Cancel button with the same reason instead of firing a request guaranteed to
fail.

The service also calls the same helper, so the UI and server can never disagree
about which statuses are cancellable.

## Verification

`src/lib/services/__tests__/purchaseOrderPermissions.core.test.ts` covers every
status, including unknown values.
