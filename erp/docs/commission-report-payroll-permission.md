# Commission reports are payroll data (ARGUS #368)

## Problem

The commission summary, payout-history and page gates accepted
`staff:view`/`staff:manage`. `payroll:view` existed but was unused for these
surfaces. A staff-directory viewer could therefore see every cashier's earned,
paid and unpaid commission totals plus the full payout history.

## Rule

Commission totals and payouts are payroll data, not directory data:

| Surface | Permission |
| --- | --- |
| `GET /api/store/staff/commissions` (summary) | `payroll:view` |
| `GET /api/store/staff/commissions/payouts` (history) | `payroll:view` |
| `POST /api/store/staff/commissions/payout` (create) | `payroll:commission:payout` (ARGUS #367, owner-only) |
| `/staff/commissions` page | `payroll:view` |
| `GET /api/store/staff/[id]/commissions` (staff detail) | unchanged staff-directory permissions |

`staff:view` remains directory-only. `src/lib/services/commission-report-access.core.ts`
is the single page rule and now checks `payroll:view`; its tests cover a
staff-only viewer being denied and an explicit payroll grant being allowed.

## Navigation

- Sidebar: **Staff Commissions** now declares `payroll:view`.
- Search index: **Staff Commissions** now declares `payroll:view`.

## Verification

- Access tests: OWNER/MANAGER allowed, CASHIER denied, staff:view-only denied,
  explicit payroll:view allowed, missing session denied.
- API route guards use the same key.

No schema, migration, package or lock change is involved.
