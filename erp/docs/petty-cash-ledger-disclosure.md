# Linked-expense ledger is disclosed, not silently truncated (ARGUS #410)

The Petty Cash table showed at most 20 linked expenses and 50 top-ups. The
balance equation totalled every row, so the visible list could not be
reconciled against opening, cash-in, expense and current totals. It also had no
recorded-by column and no running balance.

## Resolution

The list still shows a newest-first window (20 expenses and 20 cash-in rows, the
shared `PETTY_CASH_LEDGER_LIMIT`), but the page now states exactly what it is
showing:

> Showing latest 20 of 34 expenses (Rs. X total) and latest 20 of 42 cash-in
> rows (Rs. Y total). The balance equation above uses all rows. Older rows are
> not listed here; use Export for the full audit trail.

- `getPettyCashLedgerTotals` counts and sums **all** fund expenses and all
  top-up debits. Those figures are the same totals used by the balance
  equation, so the headline and the disclosure cannot disagree.
- `getPettyCashTopUps` and `loadFundWithLedger` both use the 20-row cap and
  return the actor email (`createdById` lookup for ledger top-ups,
  `recordedBy` for expenses).
- `src/lib/petty-cash/ledger.ts` merges the two lists, sorts by transaction
  date then `createdAt`/id, and builds a running balance. The newest displayed
  row ends at the live equation balance; the oldest starts from the balance
  before the shown window. The list is then reversed for display.
- The table adds **Recorded By** and **Running Balance** columns.

The balance equation continues to use full totals (`opening + all top-ups -
all expenses = current`). The running column is a windowed view, not a
replacement for the equation.

## Verification

`src/lib/petty-cash/__tests__/ledger.test.ts` covers mixed rows, the live
balance reconciliation, cent precision, string amounts, same-day tie-breaks,
an empty window and the truncation disclosure.
