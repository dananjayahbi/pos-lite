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

- The store and super-admin headers show the signed-in user's display name.
- Staff-facing surfaces (staff list/detail, time clock, shifts, commissions, user
  permissions, expenses, purchase orders, sales, appointments, stock movements,
  stock takes, broadcasts, delivery recovery) label users with the display name.
- Audit logs, production history, sales/return receipts (HTML and thermal), the
  Z-report cashier line, and the public appointment-doctor picker use the same
  label.
- `stockActorLabel()` uses the same helper, so automated stock movements still
  render `System` while human actors render their display name.
- `GET /api/reports/staff-performance` returns `name` alongside `email`
  (`email` stays for tooltips and integrations).
- `/reports/staff-performance` uses `name` for the "Revenue per Staff" bars, the
  Staff table, and the CSV/PDF export column (`Staff`). The email is available
  as the cell/bar `title` tooltip.
- CSV exports in commissions, recovery performance and stock movements use the
  display name in their person/actor columns.

The raw email remains wherever it is actual data rather than a person label
(login forms, the account profile's Email row, customer/supplier/contact
records, and integration payloads).

If a real name field is added to `User` later, only the helper needs to change —
every caller already renders `staffDisplayName()`.

## Verification

- `src/lib/utils/__tests__/staff-name.test.ts`
- `src/lib/stock/__tests__/actor-label.test.ts`
