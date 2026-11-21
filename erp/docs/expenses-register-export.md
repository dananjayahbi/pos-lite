# Expenses header export is the register (ARGUS #396)

The **Export** button on `/expenses` used to call
`/api/store/petty-cash/export`. That endpoint builds a single fund's audit
trail (`pettyCashFundId = first active fund`), so a downloaded file silently
omitted expenses paid from a bank/cash account and any unlinked historical row.

## Resolution

The header button is now **Export Register** and downloads the register the
user is looking at:

- `GET /api/store/expenses/export` requires `expense:view`.
- It honours the page filters (`category`, `dateFrom`, `dateTo`) with the same
  inclusive date bounds as the list.
- It returns every matching expense, across every payment account and
  petty-cash fund. Pagination is ignored because a register download covers
  the whole filtered set.
- The `Account` column uses the same resolver as the table, so fund-linked
  spends name the fund rather than a blank.
- CSV safety reuses the shared writer: RFC-4180 quoting via `toCsv` plus
  `neutralizeCsvFormula` for user text (description, account/fund name,
  receipt URL, recorded-by email). The literal `-` placeholder is left alone.

The petty-cash audit trail remains available from the Petty Cash page
(`/api/store/petty-cash/export`); the Expenses page no longer sends users there
by mistake.

## Verification

`src/lib/expenses/__tests__/register-export.test.ts` covers the header, mixed
bank/cash/unlinked rows, formula neutralisation, comma/quote escaping and the
download filename. `tsc` covers the route and client wiring.
