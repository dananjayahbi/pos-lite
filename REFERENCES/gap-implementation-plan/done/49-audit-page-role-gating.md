# 49 — Audit Page Direct-URL Role Gating

**Module:** M15 — Security, RBAC & Audit
**Severity:** Medium
**Status:** Partially implemented
**Related docs:** [46 — Reports API Permission Gating](./46-reports-api-permission-gating.md), [48 — SUPER_ADMIN Store Permissions](./48-superadmin-store-permissions.md)

## Issue / Current State
The audit-log page at `erp/src/app/(store)/settings/audit-log/page.tsx` has a guard that denies only `CASHIER` and `STOCK_CLERK`. Other roles that lack `viewSettings` — most notably `DISPATCH_STAFF` — can open the page by direct URL even though the settings navigation is hidden for them. The page guard is not aligned with the `viewSettings` permission (`settings:view` in `erp/src/lib/constants/permissions.ts`) or a dedicated audit permission, and it does not go through the central permission helper in `erp/src/lib/utils/permissions.ts`. This is inconsistent with how permission checks are enforced elsewhere.

## Impact
A user without settings/audit access can view the full audit log by typing the URL directly, exposing sensitive operational data (who did what, entity changes, IP addresses) to roles that should not see it. It also creates an inconsistent enforcement model: UI nav is hidden but the page remains reachable, and future roles added to the system (e.g. a factory manager) would be mis-gated unless the guard is centralized.

## Implementation Plan
### Step 1 — Align the page guard with the permission model
Update the guard in `erp/src/app/(store)/settings/audit-log/page.tsx` so it denies access based on the `viewSettings` permission (or a dedicated audit-log permission if one is added) rather than a hard-coded role list. Use the central permission helper in `erp/src/lib/utils/permissions.ts` so the check is consistent with all other guarded routes and automatically handles new roles.

### Step 2 — Enforce on the underlying API
Ensure the audit-log data API (the route the page calls) enforces the same permission via `requirePermission`/`hasPermission`, so that even if a user bypasses the page UI, the underlying endpoint rejects unauthorized requests. This mirrors the server-side gating recommended in doc 46.

### Step 3 — Centralize shared page gating
Where several settings/admin pages share the same `viewSettings` guard, factor the check into a reusable guard/higher-order component so the logic lives in one place and cannot drift between pages.

### Step 4 — Add a dedicated audit permission (optional)
If finer control is desired, introduce a dedicated audit-log permission key in `PERMISSIONS` and map it into `ROLE_PERMISSIONS` so the page and API both gate on that explicit key, while keeping `settings:view` for general settings access.

## Dependencies
- Depends on the permission helper in `erp/src/lib/utils/permissions.ts` and the `viewSettings` key in `erp/src/lib/constants/permissions.ts`.
- Consistent with the server-side gating approach described in doc 46.
- Doc 48's SUPER_ADMIN policy must be honored so the guard does not wrongly block a SUPER_ADMIN.

## Files / Areas affected
- `erp/src/app/(store)/settings/audit-log/page.tsx` (page guard)
- The audit-log data API route (server-side enforcement)
- Shared guard/higher-order component (if introduced)
- `erp/src/lib/constants/permissions.ts` and `erp/src/lib/utils/permissions.ts` (if a dedicated audit permission is added)
