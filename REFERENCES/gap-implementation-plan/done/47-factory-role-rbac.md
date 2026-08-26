# 47 — Factory Role RBAC & Restrictions

**Module:** M15 — Security, RBAC & Audit
**Severity:** Medium
**Status:** Not implemented
**Related docs:** [25 — Factory Manager Role & Dashboard](./25-factory-manager-role.md), [24 — Raw Material Inventory](./24-raw-material-inventory.md), [46 — Reports API Permission Gating](./46-reports-api-permission-gating.md)

## Issue / Current State
There is no `FACTORY_MANAGER` role in the `UserRole` enum (`erp/prisma/schema.prisma`), which currently defines only `SUPER_ADMIN`, `OWNER`, `MANAGER`, `CASHIER`, `STOCK_CLERK`, and `DISPATCH_STAFF`. There are no factory permission keys in `erp/src/lib/constants/permissions.ts` (the `STOCK`, `PRODUCT`, and `SUPPLIER` groups do not include factory-specific keys such as raw-material management or BOM), and no factory-only routes exist. Per the SRS, the factory manager should be restricted from financials, CRM, sales orders, and POS.

## Impact
Without a factory role, factory staff must be granted an existing role (e.g. `STOCK_CLERK` or `MANAGER`), which either over-exposes them to financials, CRM, sales orders, and POS, or fails to give them the raw-material/BOM capabilities they actually need. This is both a security and a usability gap: factory users are either too privileged or unable to do their job within the system.

## Implementation Plan
### Step 1 — Add the role and factory permission keys
Add `FACTORY_MANAGER` to the `UserRole` enum in `erp/prisma/schema.prisma` and regenerate the Prisma client. Add a new permission group (for example `FACTORY`) in `erp/src/lib/constants/permissions.ts` with keys such as viewing/managing raw-material inventory, viewing/managing the bill of materials, and triggering auto-deduction — reusing/extending the keys planned in docs 24, 25, and 26 where they exist.

### Step 2 — Add role-to-permission mapping
Add a `FACTORY_MANAGER` entry to `ROLE_PERMISSIONS` in `erp/src/lib/constants/permissions.ts`, following the existing pattern used by `DISPATCH_STAFF`. Grant only factory-scoped permissions (raw materials, BOM, stock view) and **explicitly exclude** financial/report, CRM, sales-order, and POS permissions. Because `getEffectivePermissions` merges role defaults with any extra stored permissions, ensure the factory defaults are the source of truth and that factory users are not seeded with over-broad stored permissions.

### Step 3 — Enforce restrictions in permission helper and routes
Confirm `getEffectivePermissions` in `erp/src/lib/utils/permissions.ts` returns factory defaults correctly, and that factory users are blocked from financial reports (doc 46), CRM, sales orders, and POS by virtue of lacking those permission keys. Add API-route gating on the sensitive areas (reports, sales/POS, CRM) using `requirePermission`/`hasPermission` so the restriction holds even on direct-URL calls, not just hidden nav.

### Step 4 — Add factory-only routes and UI
Add the factory module routes (raw-material inventory, BOM, factory dashboard per docs 24/25/26) and gate them to the `FACTORY_MANAGER` role/its permissions. Build a factory-focused dashboard/landing view that exposes only factory functions and hides financials, CRM, sales orders, and POS.

## Dependencies
- Doc 25 defines the factory manager role/dashboard scope this RBAC formalizes.
- Docs 24 and 26 define the raw-material and BOM capabilities whose permission keys this doc wires up.
- Doc 46 defines report gating that must also exclude factory users.
- Relies on the existing `UserRole` enum, `PERMISSIONS`, `ROLE_PERMISSIONS`, and the `DISPATCH_STAFF` RBAC pattern.

## Files / Areas affected
- `erp/prisma/schema.prisma` (`UserRole` enum, new migration)
- `erp/src/generated` (regenerated Prisma client)
- `erp/src/lib/constants/permissions.ts` (new `FACTORY` group, `ROLE_PERMISSIONS` entry)
- `erp/src/lib/utils/permissions.ts` (role resolution for `FACTORY_MANAGER`)
- New factory API routes and dashboard UI (per docs 24/25/26)
