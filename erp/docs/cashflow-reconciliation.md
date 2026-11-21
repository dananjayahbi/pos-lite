# Cash-flow reconciliation

The Cash Flow page used to label `completed sales - returns - expenses` as "Net
Cash Flow". That figure ignored purchase-order payments, shift cash movements,
petty-cash/account transfers and opening cash, so it disagreed with the Payment
Account Activity net by Rs 33,870.38 on live data and reconciled to nothing
(ARGUS #416).

## Rule

Cash flow is derived from the payment-account ledger
(`reconcileCash` in `src/lib/services/cashflow.core.ts`):

```
opening cash  = sum(debit - credit) for entries before dateFrom
net movement  = sum(debit - credit) in the window
closing cash  = opening cash + net movement
```

The API returns `openingCash`, `netCashFlow`, `closingCash` and a `cashBridge`
with one `{ source, debit, credit, net }` line per ledger source in the window
(sales, refunds, expenses, purchase-order payments, transfers, ...). The bridge
sums exactly to the net movement and therefore bridges opening to closing cash.

The page now shows a **Cash Reconciliation** card (opening + movement = closing
and the source bridge) and relabels the old KPI as **Net Cash Movement
(ledger)**. The income/expense sections remain a period operating summary.

## Verification

`src/lib/services/__tests__/cashflow.core.test.ts` covers a simple close,
the multi-source bridge summing to the net movement (the live sources), source
sorting and an empty window. The expense end-date fix (#394) uses the same
inclusive window parsing.
