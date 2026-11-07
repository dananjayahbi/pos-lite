# Staff commission payouts

The Staff Commissions page (`/staff/commissions`) records a commission payout as
a real money movement:

- the owner picks the **payment account** (BOC / HNB / Cash / …),
- the amount is deducted from that account's ledger,
- an **Expense** row is created with category **Staff Commissions**, and
- the expense appears in the Cash Flow statement automatically.

## Payout modal

- **Staff name** now comes from `User.fullName`; the email is shown as secondary
  text instead of being used as the display name.
- **Payment Account** is a dropdown of active `PaymentAccount` rows with their
  current balance. It replaces the old free-text “Payment Method” field.
- **Payout Amount** defaults to the full unpaid commission, and is editable for
  a partial payout. Paying Rs. 100 of Rs. 144.39 leaves Rs. 44.39 open; the
  remaining balance can be paid in a later period.
- The selected account must have enough balance (and, when it is the petty-cash
  account, the fund must be able to absorb the spend).

## What one Confirm Payout writes

Inside one database transaction:

1. `CommissionPayout` — amount paid, staff, period, authorizer, payment account
   id + name snapshot, and the linked expense id.
2. `Expense` — category `STAFF_COMMISSIONS`, amount, description naming the
   staff member and commission window, `paymentAccountId`, recorded-by.
3. `PaymentAccountEntry` — `EXPENSE` source, credit (deduction) on the selected
   account, `sourceId` = expense id. `postLedgerEntries` updates the account's
   cached balance.
4. `CommissionRecord.paidAmount` — allocated oldest-first across the period's
   records. `isPaid` flips true only when the record is fully settled, so a
   partial payout leaves the remainder visible in the summary and in payroll.

After the transaction a linked petty-cash fund balance is adjusted and an audit
event (`COMMISSION_PAYOUT_CREATED`) is written.

The resulting expense is editable/deletable like any other expense; its ledger
entries follow the normal expense reversal rules.

## Partial payouts

`CommissionRecord.paidAmount` is the new source of truth (default `0`).

- `unpaid = sum(earnedAmount) − sum(paidAmount)`.
- Legacy rows paid before this change (`isPaid = true`, `paidAmount = 0`) are
  still counted as fully paid by the summary queries.
- Allocation is pure and unit-tested in
  `src/lib/services/commission-allocation.ts`:
  - partial payment walks positive outstanding records oldest-first;
  - full settlement closes every record, including negative return
    adjustments;
  - a payment can never exceed the outstanding balance.

Payroll generation (`/payroll`) also uses `paidAmount`, so a partially paid
commission is not paid again through the monthly salary run.

## Schema

Added/changed in `prisma/schema.prisma`:

- `ExpenseCategory.STAFF_COMMISSIONS`
- `CommissionRecord.paidAmount`
- `CommissionPayout.paymentAccountId`, `paymentAccountName`, `expenseId`
- Relations on `PaymentAccount` and `Expense`.

Apply the project's usual Prisma sync (`npx prisma db push` or deployment
equivalent) before using the new payout flow.

## Tests

```
npx vitest run src/lib/services/__tests__/commission-allocation.test.ts
```

Covers the 144.39 → 100 + 44.39 split, oldest-first allocation, full
settlement with negative return adjustments, and over-payment safety.
