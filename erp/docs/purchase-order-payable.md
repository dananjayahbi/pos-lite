# Purchase-order payable follows the received invoice

`PurchaseOrder.totalAmount` stores the **expected** order value captured at
creation. Once goods arrive, what the supplier is actually owed comes from the
received quantities and the actual unit costs recorded at receipt (ARGUS #225).

## Rule

`computePurchaseOrderPayable()` (`src/lib/services/purchaseOrderPayable.core.ts`):

| State               | Payable                                          |
| ------------------- | ------------------------------------------------ |
| No receipts yet     | stored expected total (net of discount)          |
| Received (partial)  | received qty x actual cost (fallback expected)   |
| Discount            | apportioned by received / expected subtotal      |

`actualCostPrice` is recorded per line when receiving; lines without an actual
cost fall back to the expected cost. The apportioned discount can never exceed
the received value, so the payable cannot go negative.

## Where it is used

- `getPOById` and `getPOs` return `payableAmount` and `receivedValue`; the list
  shows the payable with the ordered total underneath, and the detail totals card
  labels the received value and expected order total.
- `payPurchaseOrder` caps payments at the received payable, so a higher actual
  invoice can be paid and a partially received order cannot be overpaid.
- Receiving re-evaluates `paidAt`: a previously settled order that receives a
  higher invoice becomes unpaid again instead of claiming "Paid in full".

Example: PO-202609-0001 (20 x 840 + 15 x 1,200 expected 35,000) is fully
received at those actual costs, so the payable is 34,800, not 35,000.
PO-202610-0002 received 3 of 4 units at 1,076 pays 3,228, not 4,304.

## Verification

`src/lib/services/__tests__/purchaseOrderPayable.core.test.ts` covers both
reported orders, no-receipt orders, higher actual invoices, partial-receipt
discount apportioning, expected-cost fallback and the discount clamp.
