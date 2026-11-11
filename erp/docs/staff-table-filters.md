# Staff table: columns and filters

## Columns

The staff table shows:

| Column | Source |
| --- | --- |
| Name | `fullName` when present, else the email-derived display name |
| Contact Number | `contactNumber` (`—` when absent) |
| Role | `role` badge |
| Status | active switch |
| Commission Rate | `commissionRate` |
| Actions | View (`/staff/[staffId]`) |

## Filters

`GET /api/store/staff`

| Query | Behaviour |
| --- | --- |
| `search` | Case-insensitive `contains` against `email` **or** `fullName`. |
| `role` | Exact role match, limited to `ASSIGNABLE_ROLES` (OWNER/MANAGER/CASHIER/STOCK_CLERK/DISPATCH_STAFF/FACTORY_MANAGER). |

`role=SUPER_ADMIN` (or any unknown role) is rejected with `400 VALIDATION_ERROR`.
The route treats `role=ALL` as no filter.

The staff page has:

- a single search box (`Search by name or email...`), and
- a role dropdown (`All Roles` + every assignable role),
- plus a **Clear filters** shortcut when either filter is active.

The list query key includes both filters so React Query refetches when they
change.

## Tests

`src/lib/validators/__tests__/staff.validators.test.ts` covers the query schema
(valid search/role, rejected non-assignable roles). The existing API smoke
checks in `tests/03_rbac_users.spec.ts` continue to use the unfiltered list.
