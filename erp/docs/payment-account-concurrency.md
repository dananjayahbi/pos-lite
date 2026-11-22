# Payment-account ledger concurrency

`postLedgerEntries` used to read the cached `PaymentAccount.balance`, compute the
next balance and write it back without a lock. Two concurrent withdrawals or
transfers from the same account could both see the same available balance, both
pass `assertSufficientFunds`, and both write the same next balance - losing one
movement from the balance while both entries remained in the ledger, or allowing
the account to go negative (ARGUS #425).

## Fix

Both ledger primitives now take a PostgreSQL row lock before reading the balance:

- `assertSufficientFunds` locks `payment_accounts` for the account, then checks
  funds.
- `postLedgerEntries` locks every account in the posting (sorted by id, so
  multi-account transfers cannot deadlock), then reads the committed balance and
  writes the true `balanceAfter` chain.

The lock is held until the caller's transaction commits, so a second writer
waits, re-reads the updated balance and either succeeds with the correct
before/after or fails the funds check. Callers that checked funds then posted in
the same transaction (expenses, PO settlement, withdrawals, transfers) are
serialized end-to-end.

## Scope

This relies on PostgreSQL, as the application targets. Higher-level business
rules (e.g. a deposit that credits an account) still only lock when they post;
they do not need a separate funds check because they add money.
