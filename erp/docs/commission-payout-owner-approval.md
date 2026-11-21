# Owner approval for commission payouts (ARGUS #367)

## Problem

`POST /api/store/staff/commissions/payout` required only `staff:manage`.
Managers hold that permission, so a manager could set commission rates, settle
sales and then move commission money out of an active payment account without
owner approval or any per-payout limit.

## Rule

A new permission key now gates payout creation:

```
payroll:commission:payout
```

- OWNER receives it (owner gets all permissions).
- MANAGER defaults exclude it.
- CASHIER and other roles do not have it.
- The owner may explicitly grant it to a manager through the existing
  per-user permission editor if that is the desired approval model.

`src/lib/services/commission-payout-permission.core.ts` is pure and unit tested:
`canPayCommissionPayouts(user)` checks the key. OWNER passes; MANAGER, CASHIER
and a missing session fail; an explicit grant passes.

## Enforcement

- The API checks the permission before parsing or writing anything and returns
  `403` with **Commission payouts require owner approval
  (payroll:commission:payout)**. `staff:manage` alone is no longer sufficient.
- The Reports page hides **Mark as Paid** and shows **Owner approval required**
  when the user lacks the key.
- The confirmation dialog also disables **Confirm Payout** and repeats the
  reason, so a stale open dialog cannot submit.

Read-only commission reporting is unchanged. No schema, migration, package or
lock change is involved.
