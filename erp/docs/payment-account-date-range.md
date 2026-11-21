# Payment-account date filters use one local-day helper (ARGUS #429)

The account book and tenant cash-flow ledger parsed `From` as UTC midnight and
`To` as `23:59:59.999Z`, while the Expenses cash flow used a different upper
bound. In a +05:30 store the same date label therefore included different
entries - the previous local evening leaked into "From", and the two cash-flow
pages disagreed at the day boundary.

## Rule

All three surfaces now use `resolveInclusiveDateRange` from
`src/lib/api/inclusive-date-range.ts`, the shared local-calendar helper already
used by inventory movement filters (ARGUS #184):

- `GET /api/store/payment-accounts/[accountId]/book`
- `GET /api/store/payment-accounts/cash-flow`
- `GET /api/store/expenses/cash-flow`

A date-only value means local `00:00:00.000` to local `23:59:59.999`; a full
timestamp keeps its exact instant. `src/lib/dates/inclusiveRange.ts` now
delegates to that helper instead of building UTC boundaries, and
`formatLocalDateInput` formats the Expenses page default dates from local parts
(the old `toISOString().slice(0, 10)` could show the wrong day near midnight).

## Verification

`src/lib/dates/__tests__/inclusiveRange.test.ts` asserts local-midnight and
local-end-of-day bounds, inclusion of a late local-evening entry, exact
timestamp preservation, and local date-input formatting. The existing
`src/lib/api/__tests__/inclusive-date-range.test.ts` covers the shared helper.

## Residual

Other report routes still build `new Date(...T00:00:00)` boundaries themselves;
they were outside this payment-account task and should converge on the same
helper.
