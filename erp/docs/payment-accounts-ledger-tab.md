# Payment accounts - the Ledger tab is not the Cash Flow statement

The second tab on `/payment-accounts` previously called itself "Cash Flow" but
showed a different dataset from `/expenses/cash-flow`: every ledger entry across
every account, with a per-account balance-after column (ARGUS #432).

## What changed

- The tab is labelled **Ledger**, matching what it renders.
- A caption above the table states that rows interleave accounts, that Balance
  is that account's balance after the entry, and where to find the per-account
  view (Account Book on a card).
- The column header is **Account balance after** instead of the ambiguous
  "Balance"; the footer total is **Net movement**.
- The account and date filters, source labels and pagination are unchanged.

The operating Cash Flow statement remains on `/expenses/cash-flow` and keeps
its own dataset and totals.

## Verification

- `npx tsc --noEmit`
- `npx vitest run src/lib/services/__tests__/paymentAccountLedger.core.test.ts`
