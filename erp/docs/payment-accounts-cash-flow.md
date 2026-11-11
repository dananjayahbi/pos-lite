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

## Account book

The card action **Account Book** opens a full-viewport dialog (not a drawer).
The ledger table needs the width for Date / Description / Source / Debit /
Credit / Balance; the dialog keeps a fixed header with the account name,
balance and filters, and scrolls the entries and totals separately.

## Petty cash as a destination

Petty-cash payment accounts are special: their balance is owned by the fund, so
the ledger guard still blocks incidental movements. Two explicit flows are
allowed and keep both sides in sync inside the same transaction:

- **Fund transfer into petty cash** — the destination fund's `currentBalance`
  is incremented and the `FUND_TRANSFER` leg counts toward the fund's top-up
  total. The transfer dialog shows a notice when the destination is a petty-cash
  account.
- **Closing transfer into petty cash** — the closed account's remaining balance
  is swept into the fund, its `currentBalance` is incremented, and
  `CLOSING_TRANSFER` is counted as cash in by the balance equation.

Petty cash cannot be a transfer *source*; spending from it must go through
Petty Cash → Expense. Sales never route into petty cash automatically: the sale
account resolver skips fund-managed accounts, so POS cash settles into a normal
account (or is left unposted when none exists) instead of failing the sale.

## Verification

- `npx tsc --noEmit`
- `npx vitest run` (expense validator + full suite)
- Manual: create an expense linked to an account → the account balance drops on
  `/payment-accounts`, an `EXPENSE` entry appears in its book and on
  `/expenses/cash-flow`; edit the amount → reversal + new entry; delete → reversal.
