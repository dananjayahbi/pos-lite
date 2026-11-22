# Petty cash test coverage (categories, top-ups, side effects, audit)

ARGUS #415. Module 19 covered page load, linked-expense creation and fund
reduction, fund settings, overdraw, one low-balance boolean and the export
content type. It did not cover category enforcement, the Add Expense fund
context, top-up source/date behaviour, the 20/50 ledger cap, audit payload
completeness, GET side effects or clearing the low threshold.

## Added

`tests/19_expenses_petty_cash.spec.ts`:

| Case | Covers |
| --- | --- |
| F17 | a fund-linked expense using a disabled Active Category is `422 CATEGORY_NOT_ENABLED`; categories are restored afterwards |
| F18 | `GET /api/store/petty-cash` is read-only: repeated reads keep the same fund, balance and equation |
| F19 | future-dated top-ups and `ACCOUNT` without a source account are `400`; an EXTERNAL top-up succeeds and its `PETTY_CASH_TOP_UP` audit row carries the amount and source |
| F20 | changing the threshold/categories writes `PETTY_CASH_FUND_UPDATED` with both values in `after` |

Low-threshold clearing is pinned by `petty-cash-alert.test.ts` (ARGUS #414);
the 20-expense ledger cap by `ledger.test.ts`; Add Expense fund context by
`expenses/link.test.ts`.

`src/lib/validators/__tests__/petty-cash.validators.test.ts` covers top-up
source inference (EXTERNAL vs ACCOUNT), the mutual-exclusion errors, positive
amounts, past/today vs future `entryDate`, and the 200-character description.

## Verification

- `npx vitest run src/lib/validators/__tests__/petty-cash.validators.test.ts src/lib/petty-cash/__tests__/{category-policy,ledger}.test.ts`
  (20 passed)
- `npx tsc --noEmit`
