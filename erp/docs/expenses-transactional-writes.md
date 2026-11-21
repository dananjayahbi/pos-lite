# Expense writes are one transaction under a row lock (ARGUS #403)

Linked expense writes were split across two boundaries: the expense row and
payment-account ledger committed in one transaction, then the petty-cash fund
balance was updated afterwards in another. The pre-spend check
(`assertFundCanSpend`) read the fund unlocked, so two concurrent spends could
both pass and desync the fund from the ledger. A failure between the two
writes left the expense posted while the fund still showed the old balance.

## Rule

`createExpense`, `updateExpense` and `deleteExpense` now do everything in one
`prisma.$transaction`:

1. lock every payment account the write touches (sorted ids);
2. lock every petty-cash fund it touches (sorted ids);
3. write the expense row, ledger reversal/posting and fund balance inside that
   same transaction;
4. write the audit row(s) inside the transaction;
5. only after commit, run the low-balance notification check.

`adjustFundBalanceTx` re-reads the locked fund row and applies the delta with
the pure `decideFundDelta` helper. The non-negative check therefore runs against
the same balance that is about to be written, not a stale unlocked read.

## Lock order

Accounts are always locked before funds, and each set is sorted. Top-ups and
payment-account transfers already lock accounts first and then update the fund,
so the order matches. Two edits moving expenses in opposite directions between
the same accounts/funds cannot deadlock on a different lock order.

## Consequences

- A failed ledger post, audit write or insufficient-funds check rolls the
  expense, fund delta and audit back together.
- A concurrent spend that would overdraw the fund is rejected under the lock
  with the existing `PETTY_CASH_OVERDRAW` 422 sentinel.
- The fund balance update is no longer a separate commit, so the fund and the
  account ledger cannot diverge on success or partial failure.
- Low-balance alerting is best effort after commit; an alert failure cannot turn
  a committed expense into a 500.

`commission.service.ts` still uses the older unlocked `assertFundCanSpend` /
`adjustFundBalance` path for commission payouts. That is outside this task and
is listed as an out-of-scope follow-up.

## Verification

- `src/lib/petty-cash/__tests__/fund-balance.test.ts` covers the locked-delta
  arithmetic: fitting spend, blocked spend, approved overdraw, refund and cent
  rounding.
- `npx tsc --noEmit` covers the transaction, lock and audit wiring.
