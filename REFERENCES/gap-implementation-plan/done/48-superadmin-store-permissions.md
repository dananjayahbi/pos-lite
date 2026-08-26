# 48 — SUPER_ADMIN Store-Permission Handling

**Module:** M15 — Security, RBAC & Audit
**Severity:** Medium
**Status:** Partially implemented
**Related docs:** [46 — Reports API Permission Gating](./46-reports-api-permission-gating.md), [47 — Factory Role RBAC](./47-factory-role-rbac.md)

## Issue / Current State
`SUPER_ADMIN` is treated as a platform-level role and is enforced at the platform level in routes under `erp/src/app/api/admin/*`. However, when a `SUPER_ADMIN` acts **inside a store (tenant) context**, `getEffectivePermissions` in `erp/src/lib/utils/permissions.ts` returns only the role's stored `permissions` array — and the seed value for `SUPER_ADMIN` is `[]`. Because `getEffectivePermissions` short-circuits for `SUPER_ADMIN` by returning the raw normalized stored permissions (it does not merge `ROLE_PERMISSIONS`, since there is no `SUPER_ADMIN` entry), a `SUPER_ADMIN` is **not** auto-granted any store-level permissions. This is an edge case: the platform admin may be blocked from store operations that they should be able to perform, or behave inconsistently depending on how the session scopes to a tenant.

## Impact
A platform super-admin acting in a tenant can be unexpectedly denied store functionality (or behave inconsistently across areas), causing operational confusion and support burden. Conversely, if store code begins assuming SUPER_ADMIN bypasses checks, it can open an unintended privilege hole. The undefined, undocumented behavior for the SUPER_ADMIN-in-tenant case is itself the risk.

## Implementation Plan
### Step 1 — Decide and document the policy
Formally decide the intended behavior for a `SUPER_ADMIN` acting in a store tenant. The recommended policy: grant a `SUPER_ADMIN` **full store access when acting within a tenant** (equivalent to the `OWNER` permission set), while keeping platform-level controls separate and intact in the `erp/src/app/api/admin/*` routes. Document this decision in the permissions module so it is explicit and consistent.

### Step 2 — Implement consistently in the permission helper
Update `getEffectivePermissions` in `erp/src/lib/utils/permissions.ts` so that, when the role is `SUPER_ADMIN` in a tenant context, it returns the full store permission set (e.g. all of `ALL_PERMISSIONS`, matching the `OWNER` mapping). Preserve the existing stored-permissions path for other roles. Ensure this change is applied once so every route using the helper behaves consistently.

### Step 3 — Review platform vs tenant boundaries
Audit the store-context routes (POS, sales, delivery, reports, CRM, settings) to confirm they all resolve permissions through the same helper, so the SUPER_ADMIN policy applies uniformly. Confirm the platform-level routes under `erp/src/app/api/admin/*` are unaffected and continue to enforce their own platform checks.

### Step 4 — Align report gating and RBAC docs
Make sure the SUPER_ADMIN decision is reflected in the report gating (doc 46) and factory RBAC (doc 47) so SUPER_ADMIN is not accidentally blocked from (or over-exposed to) reports or factory functions in a way that contradicts the documented policy.

## Dependencies
- Depends on the existing `getEffectivePermissions` helper and the `OWNER`/`ALL_PERMISSIONS` mappings in `erp/src/lib/constants/permissions.ts`.
- Doc 46 and doc 47 must stay consistent with the chosen SUPER_ADMIN policy.

## Files / Areas affected
- `erp/src/lib/utils/permissions.ts` (`getEffectivePermissions` SUPER_ADMIN branch)
- `erp/src/lib/constants/permissions.ts` (reference mapping for full access)
- Platform-level routes under `erp/src/app/api/admin/*` (review only; enforce platform checks)
