# 46 — Reports API Permission Gating

**Module:** M15 — Security, RBAC & Audit
**Severity:** High
**Status:** Not implemented
**Related docs:** [47 — Factory Role RBAC](./47-factory-role-rbac.md), [48 — SUPER_ADMIN Store Permissions](./48-superadmin-store-permissions.md)

## Issue / Current State
The reports API endpoints under `erp/src/app/api/reports/` (including `sales`, `profit-loss`, `revenue-trend`, `sales-by-staff`, `return-rate`, `inventory-valuation`, `customer-analytics`, `stock-movements`, `staff-performance`, and the `saved` report routes) check only authentication and `tenantId` scoping. They do **not** check permissions. The UI hides report navigation for unauthorized roles, but an authenticated user (for example a dispatch staff member who lacks `report:*` permissions) could still call the report endpoints directly by URL and receive financial data.

## Impact
This is a data-exposure gap: users with any valid session can bypass the hidden nav and retrieve sensitive financial, profit, cost, and customer analytics. It undermines the RBAC model and violates the intended separation of duties, since roles like `DISPATCH_STAFF` or `CASHIER` are not meant to view profit and cost figures.

## Implementation Plan
### Step 1 — Define per-report permission mapping
For each report endpoint, map it to the appropriate permission key already defined in `PERMISSIONS.REPORT` in `erp/src/lib/constants/permissions.ts` (for example `sales` → `report:view_sales`, `profit-loss` → `report:view_profit`, `revenue-trend` → `report:view_sales` or `report:view_profit` as appropriate, `inventory-valuation`/`stock-movements` → `report:view_stock`, `customer-analytics` → a customer-view/report permission, and `saved` report routes → the corresponding report view plus export for export actions). Document the chosen mapping so it is consistent.

### Step 2 — Enforce permissions on every reports route
Update each route under `erp/src/app/api/reports/` to call `requirePermission` (or `hasPermission`) from `erp/src/lib/utils/permissions.ts` with the mapped key before processing the request, in addition to the existing auth and `tenantId` checks. Return an unauthorized/forbidden response when the caller lacks the required permission. Cover the create/read/update/delete of saved reports as well as the raw data endpoints.

### Step 3 — Align UI gating with the same permission checks
Verify the report navigation and pages already key off the same permission keys so UI visibility and API enforcement stay consistent (no role can see a nav item they cannot access, and no role can access an endpoint they cannot see).

### Step 4 — Consider a shared helper
Where many routes need the same gating, introduce or reuse a small shared route-guard helper in `erp/src/lib/utils/permissions.ts` so the enforcement is consistent and low-duplication across all reports routes.

## Dependencies
- Relies on the existing `PERMISSIONS.REPORT` keys and the permission helper in `erp/src/lib/utils/permissions.ts`.
- Doc 48 must clarify how SUPER_ADMIN is handled so the gating does not accidentally block a SUPER_ADMIN acting in a tenant (or leave an unintended gap).
- Doc 47 adds factory roles that must also be excluded from these reports.

## Files / Areas affected
- All routes under `erp/src/app/api/reports/` (`sales`, `profit-loss`, `revenue-trend`, `sales-by-staff`, `return-rate`, `inventory-valuation`, `customer-analytics`, `stock-movements`, `staff-performance`, `saved`)
- `erp/src/lib/utils/permissions.ts` (shared route guard helper)
- Reports UI navigation/pages (for consistency with API gating)
