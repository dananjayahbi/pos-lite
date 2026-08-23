# 37 — Petty Cash Expense Categories

**Module:** M12 — Petty Cash Management
**Severity:** Medium
**Status:** Not implemented
**Related docs:** [36-standalone-petty-cash-fund](./36-standalone-petty-cash-fund.md), [41-petty-cash-export](./41-petty-cash-export.md)

## Issue / Current State
Expense categorization is a fixed enum. The `ExpenseCategory` enum in `erp/prisma/schema.prisma` contains only `RENT`, `SALARIES`, `UTILITIES`, `ADVERTISING`, `MAINTENANCE`, `MISCELLANEOUS`, and `OTHER`. This set is mirrored in the expenses page form and filters at `erp/src/app/(store)/expenses/page.tsx`.

Categories commonly used for petty-cash expenses — Staff Meals, Tea & Sugar, Office Stationery — do not exist. There is no way to classify these everyday operating spends, and there is no tenant-level configuration to tailor categories to how the business actually spends.

## Impact
Without fitting categories, everyday petty-cash spends get lumped into `MISCELLANEOUS`/`OTHER`, which produces reporting that is nearly meaningless for expense control. The owner cannot see at a glance where cash actually goes (staff meals vs. office supplies), which weakens budgeting, cost monitoring, and the export reports described in doc 41.

## Implementation Plan
### Step 1 — Extend the expense category set
Add petty-cash-specific categories (Staff Meals, Tea & Sugar, Office Stationery, and any others identified) to the `ExpenseCategory` enum in `erp/prisma/schema.prisma`. Run a migration to add the new enum values. Existing records are unaffected since this only adds options.

### Step 2 — Update the expenses form
Update `erp/src/app/(store)/expenses/page.tsx` (and its category select/filter) to include the new categories, sourced from the same enum so the form and filters never drift. Ensure the category labels shown to users are friendly (e.g., "Tea & Sugar") rather than raw enum tokens.

### Step 3 — (Recommended) Make categories configurable per tenant
Instead of relying only on a hard enum, introduce a tenant-level configuration of active expense categories (e.g., a `TenantConfig` or dedicated table listing enabled categories). The UI would render the tenant's configured set, allowing the owner to enable/disable/add categories without a code migration each time. Keep the enum as the source of allowed values, with tenant config as a filter on which are shown.

### Step 4 — Keep filters and reports in sync
Update any category filters and the export (doc 41) to use the same configured/enum category list, so analytics group by the categories the business actually uses.

## Dependencies
- [36-standalone-petty-cash-fund](./36-standalone-petty-cash-fund.md) — categories apply to standalone petty-cash expenses.
- [41-petty-cash-export](./41-petty-cash-export.md) — export groups by these categories.
- Existing `ExpenseCategory` enum and `erp/src/app/(store)/expenses/page.tsx`.

## Files / Areas affected
- `erp/prisma/schema.prisma` — `ExpenseCategory` enum additions, optional tenant category config + migration.
- `erp/src/app/(store)/expenses/page.tsx` — category select and filter.
- Optional tenant configuration service/model for active categories.
- Category-driven filters/reports (shared with doc 41).
