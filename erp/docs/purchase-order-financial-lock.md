# Purchase-order financial lock

Once money has been applied to a purchase order its financial fields and
cancellation are frozen (ARGUS #226).

## Why

A paid RECEIVED order could still be edited: changing the 1% discount to 0
recalculated the total to a higher figure while the paid amount stayed the same
and `paidAt` was never cleared, so the header said "Paid in full" while the
payment panel showed an outstanding balance. Cancelling a paid SENT order left
the payment row and its ledger credit orphaned with no refund.

## Rule

`isPurchaseOrderFinanciallyLocked(paidTotal)` (`src/lib/services/purchaseOrderPermissions.core.ts`)

| Paid amount | Editable                                      | Cancellable |
| ----------- | --------------------------------------------- | ----------- |
| 0           | reference, dates, terms, discount, account    | DRAFT/SENT  |
| > 0         | reference and dates only                      | No          |

- `updatePO` compares the submitted financial fields with the stored ones and
  rejects an actual change with **409** ("A paid purchase order cannot change
  its discount, lines, terms or payment account"). Unchanged values from a form
  save are allowed, so reference/date corrections still work.
- `cancelPO` rejects a PO with payments (**409**, "Cannot cancel ... refund or
  reverse the payments first").
- Payments are only accepted for `PARTIALLY_RECEIVED` / `RECEIVED` orders
  (**409** `PO_NOT_RECEIVED`); paying a draft/sent order before goods arrive is
  no longer possible.
- The edit dialog disables the discount, terms and payment-account controls and
  explains the lock; the cancel button is hidden when money is applied.

## Verification

`src/lib/services/__tests__/purchaseOrderPermissions.core.test.ts` covers the
lock threshold. Service changes are covered by the existing PO payment/receive
tests plus `tsc`.
