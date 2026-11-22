# Purchase-order payment state follows the paid total, not `paidAt`

`PurchaseOrder.paidAt` is a settlement stamp: the payment service sets it only
when the accumulated payments cover the whole payable amount. A list that keys
"Paid" off `paidAt` therefore reports every order with an instalment as
**Unpaid** even though money was received (ARGUS #228).

## Rule

`computePurchaseOrderPaymentState(payable, paidTotal)` in
`src/lib/services/purchaseOrderPaymentState.core.ts`:

| Paid total           | State            |
| -------------------- | ---------------- |
| `<= 0`               | `UNPAID`         |
| `> 0` and `< payable`| `PARTIALLY_PAID` |
| `>= payable` (when payable > 0) | `PAID` |

Money is rounded half-up to cents with `decimal.js`. Outstanding is
`payable - paidTotal`, clamped at zero so an overpayment never shows a negative
balance.

## Where it is used

- `getPOs` loads each order's `PurchaseOrderPayment` amounts and returns
  `paidTotal`, `outstanding` and `paymentState` alongside `payableAmount`.
- The list Payment column renders **Paid**, **Partially paid** with
  "Rs. X paid, Rs. Y due", or **Unpaid**.
- `getPOById` returns the same state, so the detail header can say
  "Partially paid - Rs. X of Rs. Y" instead of showing nothing until the order
  settles.

`paidAt` remains the settlement timestamp; it is no longer the display source of
truth. The `payPurchaseOrder` overpayment cap and the receivable payable are
unchanged (see `purchase-order-payable.md`).

## Verification

`src/lib/services/__tests__/purchaseOrderPaymentState.core.test.ts` covers
unpaid, part-paid, fully paid, a one-cent shortfall, overpayment clamping, a zero
payable and cent rounding.
