# Expenses test coverage (boundaries, audit, export, page states)

ARGUS #405. The Module 19 suite covered creation, validation, fund overdraw,
cash flow, RBAC and the export content type, but not the To-date boundary,
edit/unlink, delete history, approval/audit, filtered export contents or the
page's RBAC/error states. Its F10 assertion accepted `200`, `400` **or** `500`
for malformed dates, so a server error could pass as a contract.

## Changes

- `F10` now requires `400 VALIDATION_ERROR` for malformed dates, a reversed
  range and `page=0`. `src/lib/expenses/filter.ts` validates real calendar
  dates (`2026-02-31` is rejected) before Prisma sees an `Invalid Date`; both
  the list and export routes use it.
- `F11` asserts an expense dated on the To-date is included and that the
  returned `totalAmount` matches.
- `F12` edits amount and unlinks the fund; the fund balance returns to its
  pre-expense figure (ledger reversal, no orphaned deduction).
- `F13` deletes an expense, confirms it leaves the list and finds the
  `EXPENSE_DELETED` audit row with the description in `before`.
- `F14` records an above-threshold expense and finds `EXPENSE_CREATED` with the
  amount in `after`.
- `F15` filters the CSV export by category, date and description; only the
  matching row is present and its Amount column is `61.75`.
- `F16` verifies a cashier is redirected off `/expenses`, and a mocked 500 on
  the list shows "Could not load expenses" with Retry.

## Unit coverage

`src/lib/expenses/__tests__/filter.test.ts` covers search normalization, the
combined where clause, calendar-date validation and range ordering. Existing
`approval-policy`, `audit`, `link`, `list-state` and `register-export` tests
remain green.

## Verification

- `npx vitest run src/lib/expenses/__tests__/{filter,approval-policy,audit,register-export}.test.ts`
  (23 passed)
- `npx tsc --noEmit`
