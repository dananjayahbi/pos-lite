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

## Refund methods (ARGUS #417)

The period income section used to subtract every refund, including STORE_CREDIT
(Rs 738.40) and EXCHANGE (Rs 1,240.40) that never left a cash or bank account.
`splitCashRefunds` now separates:

- **cash-impacting**: `CASH`, `CARD_REVERSAL`
- **non-cash**: `STORE_CREDIT`, `EXCHANGE`

`totalIncome` = gross sales - cash refunds; non-cash refunds are shown as their
own line and the refund-method split is displayed. The ledger-based closing cash
is unaffected (those credits post no ledger credit).

## Ledger vs income statement (ARGUS #418)

Payment Account Activity and the Income section describe different populations,
so the page used to present them side by side with no explanation:

- ledger sale debits were Rs 151,394.52 while Gross Sales was Rs 138,834.03;
- SALE_REFUND credits were Rs 136,306.30, of which Rs 128,766.70 were void
  reversals (59 entries) and only Rs 7,539.60 were actual returns;
- Rs 160,125.00 of opening balances were counted inside Money In;
- the table's Net column looked like an all-time balance.

`summarizeAccountLedger` in `src/lib/services/cashflow.core.ts` now classifies
every ledger row by population: sales, return refunds, cancelled-return
reversals, void reversals, opening balances, each transfer source, expenses,
purchase-order payments and adjustments. `classifySaleRefundEntries` resolves a
SALE_REFUND row's `sourceId` against return ids and sale ids, because a void and
a return refund share the same ledger source.

The report now shows:

- **Ledger Movement by Source** - debit / credit / net per population, with
  opening balances and transfers marked as excluded;
- **Ledger to Income Statement Bridge** - ledger sales vs Gross Sales, ledger
  return refunds vs statement returns and cash refunds, non-cash refunds (which
  never post a ledger row), the void-reversal population, opening balances
  excluded, and explicit exception rows for any variance;
- **Payment Account Activity** columns renamed to Operating In / Operating Out /
  Transfers Net / Opening Balance / Period Movement / Current Balance (all time).
  Operating totals exclude opening balances and transfers, so they are not
  inflated by capital entries, and period movement is never presented as an
  all-time balance.

## Verification

`src/lib/services/__tests__/cashflow.core.test.ts` covers a simple close,
the multi-source bridge summing to the net movement (the live sources), source
sorting, an empty window, SALE_REFUND population splitting, operating movement
excluding opening balances/transfers, and the ledger-to-income bridge
exceptions. The expense end-date fix (#394) uses the same inclusive window
parsing.
