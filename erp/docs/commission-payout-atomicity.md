# Commission payout fund atomicity (ARGUS #369)

A commission payout writes four money moves:

1. the `CommissionPayout` row,
2. the `STAFF_COMMISSIONS` expense,
3. the payment-account ledger debit, and
4. for a petty-cash account, the fund's running balance.

All four now commit in one `prisma.$transaction`. The fund leg uses
`adjustFundBalanceTx(tx, ...)` with `enforceNonNegative`, so an overdraft or a
failed write rolls the payout back instead of leaving a committed payout without
the fund reduction.

`assertFundCanSpend` still runs first as a read-only fast fail with a friendly
message; the transaction is the authoritative check. Only the low-balance
notification runs after commit, because the money has already moved and a
notification failure must not reverse it.

`getCommissionPayouts` continues to hide `PAYROLL_PENDING:` reservations until
the payroll run is marked paid.
