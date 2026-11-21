# Expense financial history (ARGUS #401)

Expense edits changed the row but left the ledger narrative stale, an update
wrote no audit row, and the create/delete audits were fire-and-forget. Deletes
also hard-removed the row with no durable tombstone in the same transaction.

## Changes

### Ledger narrative

`updateExpense` now reposts the `EXPENSE` ledger line when the category or
description changes, not only when account/amount/date changes. The old line is
reversed (`ADJUSTMENT`, append-only) and a new line is posted with the
updated `category - description` narrative. A narrative-only edit is net zero
for the account and fund balance.

### Durable audit trail

- `AUDIT_ACTIONS.EXPENSE_UPDATED` was added.
- Create, update, delete and petty-cash-overdraw audits are written with
  `tx.auditLog.create` inside the same transaction as the expense and ledger
  writes. They are no longer fire-and-forget and cannot be lost after a
  successful response.
- Update records `before` and `after` snapshots (`category`, `amount`,
  `description`, `expenseDate`, receipt, fund id, account id). The pure
  `expenseAuditSnapshot` / `expenseChangedFields` helpers decide the shape and
  whether anything changed.

### Delete

The `Expense` model has no `status`, `deletedAt` or void flag. A true
void/reverse row is therefore impossible without a migration. The closest safe
implementation keeps the hard delete but:

- reverses the payment-account ledger in the same transaction;
- refunds the petty-cash fund (transactional write work tracked separately);
- writes `EXPENSE_DELETED` with the full before snapshot in the same
  transaction, as the durable tombstone.

**Schema limitation:** deleting still removes the expense row. A future
migration adding `voidedAt`/`voidedById` would allow the row to remain and be
excluded from reports.

## Verification

- `src/lib/expenses/__tests__/audit.test.ts` covers snapshot normalization,
  changed-field detection and the no-change case.
- `npx tsc --noEmit` covers the transaction/audit wiring.
