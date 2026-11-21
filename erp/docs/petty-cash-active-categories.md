# Petty-cash Active Categories are enforced (ARGUS #407)

A fund can enable a set of expense categories, but the setting was cosmetic:
the Expenses form offered all 12, the API accepted any of them, and the
Petty Cash page's **Add Expense** link dropped the fund. In the reported case
four of five linked expenses were Rent, Salaries, Utilities and Advertising
while the fund enabled only the five day-to-day categories.

## Rule

- `src/lib/petty-cash/category-policy.ts` owns the decision. An enabled set is
  an allow-list; an empty set enables nothing; `null`/`undefined` (no fund
  configuration loaded) does not restrict.
- `createExpense` rejects a fund-linked create whose category is not enabled,
  before writing the expense row or ledger entry. The error is
  `422 CATEGORY_NOT_ENABLED`.
- `updateExpense` applies the same check when the update writes a category or
  moves the expense onto a fund. An untouched category on a legacy row stays
  editable so historical data can still be corrected.
- The Expenses form, when a petty-cash fund is selected, offers only that
  fund's enabled categories. An edit keeps the current category selectable even
  if it has since been disabled.
- The Petty Cash page's Add Expense link carries `?fundId=<id>`; the Expenses
  page opens the create dialog with that fund selected, shows the fund's
  payment account, and falls back to the first enabled category when the
  default is not allowed.

The server remains authoritative. Hiding options is only a convenience.

## Verification

- `src/lib/petty-cash/__tests__/category-policy.test.ts` covers the allow-list,
  empty-set, unrestricted and canonical-order cases.
- `npx tsc --noEmit` and the focused Vitest command cover the API and form
  wiring.

The Playwright fixture that created a `MAINTENANCE` expense after limiting the
fund to `MISCELLANEOUS`/`TRAVEL`/`STAFF_MEALS` now uses an enabled category.
