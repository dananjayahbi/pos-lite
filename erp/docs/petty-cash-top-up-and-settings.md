# Petty cash: Add Cash In, fund settings, and ledger sync

## Overview

Each petty-cash fund is now backed by one default **CASH** payment account.
The fund balance, the payment-account ledger, and the Expenses page all move
together:

```
Opening Balance + Cash In (Top-ups) − Linked Expenses = Current Balance
```

The `PettyCashFund.paymentAccountId` link is created lazily the first time the
petty-cash page (or an expense) needs it. Existing linked expenses are
backfilled into that account's book with `EXPENSE` entries, so editing or
deleting a legacy expense still reverses the correct ledger line.

## Add Cash In

`POST /api/store/petty-cash/top-up` (permission `petty_cash:manage`)

```json
{
  "amount": 10000,
  "sourceAccountId": "cm...bank-account",
  "description": "Optional note",
  "entryDate": "2026-11-06"
}
```

- `sourceAccountId` **selected** → posts a `FUND_TRANSFER` pair: credit the
  source account, debit the petty-cash account.
- `sourceAccountId` **omitted/null** → posts an external `DEPOSIT` debit on the
  petty-cash account.
- The fund's `currentBalance` is incremented in the same transaction.
- The account book and Cash Flow page immediately reflect the movement.
- The ledger entry doubles as the transaction row shown in **Linked Expenses**:

```
06 Nov 2026 | Cash In | Petty Cash Replenished from Bank | +Rs. 10,000.00
```

Amounts are rendered in green (`+Rs. …`) and expenses stay negative
(`-Rs. …`).

The top-up endpoint is the only supported way to add money to the petty-cash
payment account. Direct deposit/withdraw/transfer/close actions on that account
are rejected with `409 CONFLICT` so the two balances cannot drift.

## Fund settings

The old **Fund Configuration** card is gone from the petty-cash dashboard.

A **Settings** button sits next to **Export** and opens an owner-only modal:

- **Fund Name** — also renames the linked payment account so `/payment-accounts`
  stays readable.
- **Low-Balance Threshold (LKR)** — optional; clearing it disables the alert.

Server enforcement uses the owner-only `petty_cash:settings:manage` permission
(`PETTY_CASH.manageFundSettings`); `PATCH /api/store/petty-cash` returns
`403 FORBIDDEN` when a user without it sends `name`, `lowBalanceThreshold`, or
`openingBalance`. Managers can still update the active expense-category
switches with `petty_cash:manage`.

The opening balance is intentionally not editable in this modal. Cash is added
through **Add Cash In**, which records a ledger transaction instead of
rewriting the allocation.

## Linked Expenses table

The table is now a merged, newest-first list of:

- linked `Expense` rows (as before), and
- `Cash In` top-up rows derived from the petty-cash account's debit entries
  (`DEPOSIT` / `FUND_TRANSFER`, excluding the opening balance).

## Expenses page

- Selecting a petty-cash fund auto-selects the fund's payment account and
  disables the account picker.
- The expense service resolves the pair server-side: a fund forces its account,
  and choosing a linked account implies its fund.
- Creating, editing, or deleting a linked expense updates the fund balance and
  the payment-account ledger in the same flow.

## Payment Accounts page

The linked account shows a **Petty Cash** badge and its balance. Close (and the
money-movement actions) are hidden for managed accounts; rename/type changes are
rejected in favour of the fund settings modal. Account Book remains available.

## Tests

- `src/lib/validators/__tests__/petty-cash.validators.test.ts` — Add Cash In
  payload contract (amount, source, date, description bounds).
- `src/lib/services/__tests__/petty-cash-alert.test.ts` — top-up description
  naming and low-balance alert behaviour.

Manual verification covered a Rs. 10,000 top-up from a BANK account
(fund/account/source balances all moved), the green `Cash In` row, owner
settings rename + threshold, and an expense create/delete round-trip with both
balances returning to their prior values.
