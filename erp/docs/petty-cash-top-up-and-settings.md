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

## Filtered export statement (ARGUS #395)

`GET /api/store/petty-cash/export` is a **period statement**, not an all-time
balance with a filtered expense list:

```
Opening (period start) + Cash In (in period) − Expenses (in period) = Closing
```

- Opening = fund opening allocation + top-up ledger debits before the window −
  expenses before the window.
- Date bounds are inclusive: a `YYYY-MM-DD` `dateTo` expands to 23:59:59.999
  (`parseRangeStart` / `parseRangeEnd`, reused from #394).
- A top-up outside the window is never shown as cash-in. If it predates the
  window it is baked into opening; if it follows the window it is ignored.
- The balance statement covers the **whole fund**; the optional category filter
  applies only to the expense rows and category totals. The CSV writes a
  `Basis:` line so the period and filter scope are explicit.
- The unfiltered export still shows the all-time opening/closing, now labelled
  `Closing Balance (all time)` rather than `Current Balance`.

## Ledger reconciliation (ARGUS #406)

`topUpPettyCash` writes the top-up audit row **inside the same transaction** as
the fund-account debit, and records `after.ledgerEntryIds` / `after.entryDate`.
A top-up can no longer exist as an audit without its ledger movement.

The read-only audit + repair CLI (never automatic) is:

```bash
cd erp
node --env-file=.env --import tsx scripts/petty-cash-reconcile.ts
node --env-file=.env --import tsx scripts/petty-cash-reconcile.ts --apply
node --env-file=.env --import tsx scripts/petty-cash-reconcile.ts --apply --rebuild-balance-after
node --env-file=.env --import tsx scripts/petty-cash-reconcile.ts --tenant=<id>
```

- It walks the fund account's entries in date/id order and reports every
  `balanceAfter` break (`expected = previous actual + debit − credit`).
- It matches `PETTY_CASH_TOP_UP` audits to the fund account's top-up debits
  (explicit ledger ids when present, otherwise amount + UTC day) and reports
  missing audits and missing ledger lines.
- `--apply` appends one explicit `DEPOSIT` correction for each unmatched top-up
  audit (idempotent via `sourceId = pc_correction_<auditId>`), then recomputes
  `PettyCashFund.currentBalance` from opening + all ledger top-ups − expenses.
  It does **not** touch the source account; the output names it for review.
- `--rebuild-balance-after` (only with `--apply`) rewrites the historical
  `balanceAfter` column in one transaction and writes a
  `PETTY_CASH_LEDGER_BALANCE_REBUILT` audit row. Debits, credits and amounts are
  never changed. This is the only way to make earlier rows chain correctly, so
  it is explicit and documented rather than automatic.
- A missing top-up changes the fund equation when applied (the audited money is
  added); always run the read-only mode and review the output first.

Pure helpers/tests: `src/lib/services/pettyCashReconciliation.core.ts`,
`src/lib/services/__tests__/pettyCashReconciliation.core.test.ts`.

## Tests

- `src/lib/validators/__tests__/petty-cash.validators.test.ts` — Add Cash In
  payload contract (amount, source, date, description bounds).
- `src/lib/services/__tests__/petty-cash-alert.test.ts` — top-up description
  naming and low-balance alert behaviour.
- `src/lib/services/__tests__/pettyCashReport.core.test.ts` — period
  opening/closing arithmetic and out-of-window top-ups.
- `src/lib/services/__tests__/pettyCashReconciliation.core.test.ts` — ledger
  trail breaks, balanceAfter rebuild, top-up audit matching.

Manual verification covered a Rs. 10,000 top-up from a BANK account
(fund/account/source balances all moved), the green `Cash In` row, owner
settings rename + threshold, and an expense create/delete round-trip with both
balances returning to their prior values.
