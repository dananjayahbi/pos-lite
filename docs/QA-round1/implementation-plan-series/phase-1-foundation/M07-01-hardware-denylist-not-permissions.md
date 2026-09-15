# M07-01 — BUG-80: hardware routes gate on a role DENYLIST, not permissions (DISPATCH_STAFF can reconfigure POS hardware)

**Severity:** P2-Major · **Module:** 07 Settings/Hardware · **QA pins:** `tests/07_settings_taxes_hardware.spec.ts` S4, S5 · **Depends on:** nothing · **Parent:** XC-03 (permission-gate consistency)

## Verified source state (2026-09-15) — still holds
- `src/app/api/settings/hardware/route.ts:5,25-30`, `src/app/api/hardware/test-print/route.ts:6,25-30`, `test-drawer/route.ts:7,25-30`, and page `src/app/(store)/settings/hardware/page.tsx:9,48` all use `const DENIED_ROLES = new Set(['CASHIER','STOCK_CLERK'])` + `DENIED_ROLES.has(session.user.role)` → 403/redirect. **No `hasPermission` anywhere in the family.**
- Meanwhile the sidebar (`src/components/layout/StoreSidebar.tsx:333`) gates the Hardware link on `PERMISSIONS.SETTINGS.manageHardware` (`'settings:hardware'`, `permissions.ts:80`) — so nav and routes **disagree**: DISPATCH_STAFF (no `settings:hardware` in `ROLE_PERMISSIONS`) can't see the link but can PATCH the config and fire test-print/test-drawer at the API directly.
- Taxes route correctly uses `settings:tax` permission (QA-verified) — hardware is the odd family out.

## Fix approach
1. Replace the denylist with the permission check on all four files: `hasPermission(session, 'settings:hardware')` (or the shared `requirePermissionResponse` helper used by other routes — align with XC-03's single-guard decision if that lands first).
2. Page-level: use the same guard → redirect (keep destination `/pos` for denied roles, matching current page behavior; QA pins the redirect target).
3. SUPER_ADMIN nuance: `getEffectivePermissions` gives ALL_PERMISSIONS (`auth.ts:129`) but SUPER_ADMIN has no tenant → hardware settings are tenant-scoped; keep the existing no-tenant rejection (401/403) — do NOT let the permission check mask the tenant check.

## Files
- `src/app/api/settings/hardware/route.ts`, `src/app/api/hardware/test-print/route.ts`, `test-drawer/route.ts`, `src/app/(store)/settings/hardware/page.tsx`.

## Acceptance / gate
- `tests/07` S4/S5 flip: DISPATCH_STAFF PATCH → 403; test-print → 403. CASHIER/STOCK_CLERK denial unchanged; taxes/store-profile gates unchanged.
