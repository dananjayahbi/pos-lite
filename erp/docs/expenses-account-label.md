# Expenses Account column for fund-linked spend (ARGUS #399)

Five fund-linked expenses showed `-` in the Account column even though
`pettyCashFundId` was set and a matching `EXPENSE` ledger credit existed. The
column only looked at `paymentAccountId`, which is null when the spend settles
through the fund's own account.

## Resolution

`src/lib/expenses/account-label.ts` resolves one label and one link for both
the list and the detail dialog:

1. a direct payment account wins - name from the loaded relation or a lookup
   map, linked to `/payment-accounts`;
2. otherwise a linked petty-cash fund shows the fund name, linked to
   `/petty-cash`;
3. only a genuinely unlinked expense renders `-`.

`getExpenses` and `getExpenseById` now include
`paymentAccount { id, name }` and `pettyCashFund { id, name }`, so the label
does not depend on the active-account picker or on the currently selected
fund. The shared `ExpenseAccountCell` component keeps the two surfaces
consistent.

## Verification

`src/lib/expenses/__tests__/account-label.test.ts` covers account preference,
fund fallback, relation vs lookup resolution, unknown-id fallbacks, the
unlinked hyphen and blank embedded names.
