# Cash Flow test coverage (ARGUS #424)

The F5 suite only checked that `totalExpenses >= 0` and that
`expensesByCategory` was an array. The reconciliation and boundary cases now
live beside the existing core tests:

`src/lib/services/__tests__/cashflow.core.test.ts`

- Gross Sales minus cash refunds equals Net Cash Income (credit/exchange refunds
  do not reduce cash).
- An empty sales window balances at zero; over-allocation is still flagged.
- `SALE_REFUND` rows split into returns, void reversals, cancelled-return
  reversals and unmatched entries (`return-cancel:` prefix).
- Purchase-order payments and adjustments stay separate ledger populations.
- A net-outflow window closes below opening cash.
- Shift summaries with only petty-cash rows keep the opening float at zero.

`src/lib/reports/__tests__/cashflowReportState.test.ts`

- 401 and 403 both map to the denied surface; no retry is offered.
- A 500 without a server message renders the default text instead of a blank
  error card.
- Permission loading wins over a stale error.

`src/lib/reports/__tests__/cashflowRange.test.ts` covers the invalid-range
validation added in ARGUS #422.
