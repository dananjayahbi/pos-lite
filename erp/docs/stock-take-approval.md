# Stock-take approval

Approval reconciles the physically counted quantity with the stock level **at
approval time**, not with the snapshot captured when the count started
(ARGUS #138).

## Why

`StockTakeItem.systemQuantity` is frozen when the item is added, and its
`discrepancy` is computed against that snapshot. Stock can then move while the
count sits in `PENDING_APPROVAL` (sales, deliveries, manual adjustments). The old
approval applied the stored discrepancy as a delta, so a session that counted 48
against a snapshot of 48 while current stock had risen to 50 left the variant at
50 instead of 48.

## Behaviour

`approveStockTake` (`src/lib/services/inventory.service.ts`) reads the current
`stockQuantity` of every counted variant inside the approval transaction and
builds the plan with `computeStockTakeApprovalPlan`
(`src/lib/services/stockTakeApproval.core.ts`):

| Counted | Current stock | Applied delta |
| ------- | ------------- | ------------- |
| 48      | 50            | -2            |
| 48      | 48            | 0             |
| 12      | 8             | +4            |

Each non-zero delta is written through `adjustStockInTx` with reason
`STOCK_TAKE_ADJUSTMENT` and the session id, so Stock History explains the change.
The stored line `discrepancy` is rewritten to the applied delta, keeping the
session detail consistent with what actually happened; `systemQuantity` and
`countedQuantity` are never rewritten.

Uncounted rows cannot reach approval (completion refuses them). If a counted
variant no longer exists, approval fails with a clear error instead of silently
applying a stale delta or hiding the row.

## Verification

`src/lib/services/__tests__/stockTakeApproval.core.test.ts` covers the reported
48-vs-50 case, unchanged stock, stock that arrived after the count, a zero delta,
uncounted items and missing variants.
