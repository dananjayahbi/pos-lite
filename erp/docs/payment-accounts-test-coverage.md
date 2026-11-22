# Payment accounts - test coverage

ARGUS #434 noted that only `39_table_surfaces` mentioned this page. Coverage
now pins the money and access rules that were previously surface-only.

## Covered

- `paymentAccountLedger.core.test.ts` - debit/credit balance arithmetic
  (including cent precision and overdraw into a negative balance) and ledger
  page-count maths, in addition to the existing source classification tests.
- `paymentAccountOptions.core.test.ts` - active-only options and the
  deposit/withdraw petty-cash exclusion (ARGUS #431).
- `paymentAccount.validators.test.ts` - create/update opening balances,
  positive deposit/withdraw amounts, same-account transfer rejection, close
  payload and account-book paging bounds.
- `paymentAccountAccess.core.test.ts` - owner/manager get the ledger and
  movement capabilities; cashier/stock clerk get destination selection only.
- `paymentAccountPolicy.test.ts` - opening-balance / movement approval policy.
- `payment-account-audit.test.ts` - financial audit rows are written in the
  caller's transaction, so a failure rolls the movement back.
- `inclusive-date-range.test.ts` - the shared local-day boundaries used by the
  book and tenant ledger.

Concurrency (per-account row locks) is exercised by the service's
`lockForUpdate` calls; it needs a live database, so there is no unit test here.

## Verification

- `npx tsc --noEmit`
- `npx vitest run src/lib/services/__tests__/paymentAccountLedger.core.test.ts src/lib/validators/__tests__/paymentAccount.validators.test.ts`
