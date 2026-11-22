# Full petty-cash settings audit and dirty guards (ARGUS #411)

`PETTY_CASH_FUND_UPDATED` recorded only `name`, `openingBalance` and
`isActive` before, and only `name`/`openingBalance` after. Changes to
`lowBalanceThreshold` or `activeCategories` were invisible. The UI also left
**Save Categories** enabled before any toggle and **Save settings** enabled
without edits, producing no-op audit rows.

## Full diff

`src/lib/petty-cash/fund-settings.ts` snapshots every setting:

- `name`
- `openingBalance`
- `lowBalanceThreshold`
- `isActive`
- `activeCategories` (compared as a set, so order does not count)

`updateFund` computes the before/after diff first. The audit row now stores
both full snapshots and an `after.changedFields` list, written **inside the same
transaction** as the fund update. Category-only and threshold-only changes are
now visible.

## No-op saves

If the diff reports no change, `updateFund` returns the existing fund without
updating the row, renaming the payment account, rechecking alerts or writing an
audit row. The server therefore cannot create no-op history even if a caller
skips the UI guards.

## Dirty guards

- **Settings**: the dialog compares the trimmed name and parsed threshold with
  the initial values. Save is disabled until something actually changes (and
  while invalid).
- **Categories**: the dashboard enables **Save Categories** only when the
  pending set differs from the stored set. Before the first toggle there is no
  pending set, so the button stays disabled.

## Verification

`src/lib/petty-cash/__tests__/fund-settings.test.ts` covers order-insensitive
category equality, every changed-field family, decimal normalization, the
category dirty guard and the settings dirty guard. `npx tsc --noEmit` covers
the service and dialog wiring.
