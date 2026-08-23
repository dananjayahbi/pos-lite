# 25 — Factory Manager Role

**Module:** M8 — Factory & Raw Materials
**Severity:** High
**Status:** Not implemented
**Related docs:** 24-raw-material-inventory.md, 26-bom-auto-deduction.md, 27-raw-material-alerts.md

## Issue / Current State
There is no factory-oriented role in the system. The `UserRole` enum in `erp/prisma/schema.prisma` contains only SUPER_ADMIN, OWNER, MANAGER, CASHIER, STOCK_CLERK, and DISPATCH_STAFF. There is no `FACTORY_MANAGER` role and no factory-scoped permission keys, so factory staff cannot be given tailored access. The permission/role model lives in `erp/src/lib/constants/permissions.ts`.

There is no factory dashboard route, and nothing restricts office-side surfaces from factory staff or vice versa. Factory management is simply not representable in the current RBAC model.

## Impact
Without a dedicated factory role, factory operations either fall to broad admin accounts (excess privilege) or are inaccessible to the staff who actually run production. This is a security and operational problem: production, raw-material stock, and BOM tasks need their own permission surface so factory managers are scoped correctly and office staff are not exposed to factory tooling.

## Implementation Plan
### Step 1 — Role enum
Add `FACTORY_MANAGER` to the `UserRole` enum in `erp/prisma/schema.prisma` and create a Prisma migration. Update the generated client and any UI that enumerates roles.

### Step 2 — Permission keys
Add factory-specific permission keys to `erp/src/lib/constants/permissions.ts` (e.g. view raw materials, adjust raw stock, view/manage BOMs, log production, acknowledge alerts). Keep them distinct from store/inventory permission keys.

### Step 3 — Role-permission mapping
Map `FACTORY_MANAGER` to the new factory keys in the role→permission configuration so the role receives exactly the factory surface and nothing office-specific. Ensure existing roles remain unaffected.

### Step 4 — Factory dashboard route
Create a factory-only dashboard route under `erp/src/app/(store)/` (or a dedicated factory area) that surfaces raw-material stock, BOMs, production logging, and alerts. Gate the route and its data access on `FACTORY_MANAGER` permission so office staff do not see factory tooling.

## Dependencies
- 24 provides the raw-material inventory surface the factory dashboard displays.
- 26 and 27 extend the dashboard with production logging and alerts.
- Role-seeding paths (e.g. tenant provisioning / staff service) must assign the new role.

## Files / Areas affected
- `erp/prisma/schema.prisma` — `UserRole` enum.
- `erp/src/lib/constants/permissions.ts` — permission keys and role mapping.
- New factory dashboard route under `erp/src/app/`.
- `erp/prisma/migrations/` — new migration.
- Staff/role assignment surfaces under `erp/src/components/staff/` or equivalent.
