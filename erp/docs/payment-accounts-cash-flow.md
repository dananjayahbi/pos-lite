# Payment accounts ↔ expenses ↔ cash flow

The payment-account ledger is the authoritative record of money movement. The
Expenses and Cash Flow surfaces must stay in sync with it.

## Expense flow

1. **Create/Edit Expense** shows an optional **Payment Account** selector.
   - Selecting an account posts an `EXPENSE` **credit** for the expense amount on
     the same `expenseDate`.
   - Leaving it unlinked keeps legacy/petty-cash-only expenses working.
2. Expense creation, the account balance check and the ledger entry run in one
   transaction. A closed account or insufficient balance therefore rolls back
   the expense instead of leaving an orphaned row.
3. Editing an expense that changes its account, amount or date:
   - posts a reversing `ADJUSTMENT` entry for the old `EXPENSE` entries, then
   - posts a fresh `EXPENSE` credit for the new amount/account.
4. Deleting an expense posts the same reversal before deleting the row, so the
   account balance and ledger never keep a deleted expense.

Reversals are append-only; historical entries are never mutated or removed.

## Cash Flow page

`/expenses/cash-flow` now returns and renders **Payment Account Activity** for
the selected window:

- money in / money out / net per account, plus the account's current balance;
- totals across accounts.

The existing operating summary (sales − refunds − expenses) remains the
operating cash-flow figure. Internal transfers, deposits, withdrawals and
opening balances appear in the payment-account section separately; internal
transfers net to zero and must not change operating cash flow.

## Verification

- `npx tsc --noEmit`
- `npx vitest run` (expense validator + full suite)
- Manual: create an expense linked to an account → the account balance drops on
  `/payment-accounts`, an `EXPENSE` entry appears in its book and on
  `/expenses/cash-flow`; edit the amount → reversal + new entry; delete → reversal.
