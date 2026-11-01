# Staff display names

`User` has no `name` column — accounts are identified by email only. Reports
that need a person label therefore derive one from the mailbox local part with
`staffDisplayName()` (`src/lib/utils/staff-name.ts`):

| Email | Display name |
| --- | --- |
| `owner@dilani-ayurwellness.lk` | Owner |
| `cashier1@ayurpos.dev` | Cashier 1 |
| `stock.clerk@shop.lk` | Stock Clerk |
| `front-desk_lead@shop.lk` | Front Desk Lead |

The rule: take the part before `@`, split trailing digits into their own token,
treat `.`, `_`, `-` and `+` as word separators, then title-case each token.
Missing/invalid emails render `Unknown` (the raw email is never echoed).

## Where it applies

- `GET /api/reports/staff-performance` returns `name` alongside `email`
  (`email` stays for tooltips and integrations).
- `/reports/staff-performance` uses `name` for the "Revenue per Staff" bars, the
  Staff table, and the CSV/PDF export column (`Staff`). The email is available
  as the cell/bar `title` tooltip.

If a real name field is added to `User` later, only the API mapping needs to
change — the client already renders `name`.

## Verification

`src/lib/utils/__tests__/staff-name.test.ts`.
