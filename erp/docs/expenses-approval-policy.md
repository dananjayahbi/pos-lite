# Expense write approval policy (ARGUS #397)

The `Expense` model has no `status` or `approvedById` column, so the app cannot
record a separate approval decision. Previously `expense:approve` was only used
for the petty-cash overdraft checkbox, while create/edit/delete were
self-service for anyone holding `expense:create`.

## Rule

`src/lib/expenses/approval-policy.ts` decides whether a write is an approval
decision:

| Action          | Approval required                                   |
| --------------- | --------------------------------------------------- |
| create          | amount strictly above `EXPENSE_APPROVAL_THRESHOLD`   |
| update          | always                                              |
| delete          | always                                              |

"Approval" means the actor holds `expense:approve`. By the role matrix that is
`OWNER` and `MANAGER`; it can also be granted explicitly. The threshold defaults
to **Rs 5,000** and can be set with the `EXPENSE_APPROVAL_THRESHOLD` environment
variable (a missing, empty, non-numeric or negative value falls back to the
default, so a typo cannot disable the control).

The API enforces this before touching the database:

- `POST /api/store/expenses` still requires `expense:create`, then rejects a
  create above the threshold with `403 APPROVAL_REQUIRED`.
- `PATCH /api/store/expenses/[id]` requires `expense:create` and
  `expense:approve` for every edit.
- `DELETE /api/store/expenses/[id]` requires `expense:create` and
  `expense:approve` for every delete.

The Expenses page hides Add Expense when the actor cannot create, hides the
edit control unless the actor can create and approve, and shows the threshold
to create-only users.

## Residual gap (documented limitation)

This gates **who may write**, not a full approval workflow. Because there is no
status/approved-by column:

- an approved write is still recorded immediately by the approver;
- there is no pending, rejected or "awaiting approval" state;
- the audit log records the actor who made the write, not a separate approver
  distinct from that actor;
- a user with `expense:approve` is trusted for all values and all edits.

Closing the gap needs a schema migration (status, approved-by, decision
timestamp) and is intentionally out of scope for this fix.

## Verification

`src/lib/expenses/__tests__/approval-policy.test.ts` pins the threshold
parsing, the above/below boundary, the always-on edit/delete gate and the
approver path.
