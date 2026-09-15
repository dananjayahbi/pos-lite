# M08-03 — BUG-37: `/api/audit-logs` rejects SUPER_ADMIN with 401 "No tenant associated" (system actor is audit-blind at the API layer)

**Severity:** P2-Major · **Module:** 08 Super Admin / 35 Audit · **QA pin:** `tests/08_superadmin_tenants.spec.ts` A3 · **Depends on:** nothing · **Related:** OBS-72 (bridge rows `tenantId:null` invisible), M35-02

## Verified source state (2026-09-15) — still holds
- `src/app/api/audit-logs/route.ts:17-23` — reads `session.user.tenantId`; if falsy → **401 "No tenant associated"** *before* the permission check on line 25 (`requirePermissionResponse(..., viewAuditLog)`).
- Seeded SUPER_ADMIN has `tenantId: null` (`seed.ts:238-242`) and gets `ALL_PERMISSIONS` via `getEffectivePermissions` (`auth.ts:129`) — so the (would-pass) permission check is never reached; the system actor is rejected with a message that reads like a session bug, not an authorization decision.
- The `/superadmin/system` page works around this by querying Prisma directly (page-level), so the UI shows a tail but the **API** — the intended programmatic surface — is unusable for SUPER_ADMIN.

## Fix approach
1. Branch on role before tenant-scoping: if `session.user.role === 'SUPER_ADMIN'` (tenantless by design), serve a **cross-tenant** audit view (no `where.tenantId`, or an optional `?tenantId=` filter) — the system-wide ledger is exactly what a platform operator needs. Require `viewAuditLog` (SUPER_ADMIN has it).
2. Tenant-scoped roles keep the existing behavior (their tenantId filters the feed).
3. Do NOT return 401 for SUPER_ADMIN; the "no tenant" condition is legitimate for the system role, not an error.
4. Coordinate with OBS-72: middleware-bridge audit rows are written with `tenantId:null` and are invisible to the *tenant* feed — a SUPER_ADMIN cross-tenant view should also surface those system rows (they're currently the only place auth events like `SESSION_INVALIDATED_BY_VERSION_MISMATCH` land). Full surfacing is M35-02; here just ensure the SUPER_ADMIN path doesn't further hide them.

## Files
- `src/app/api/audit-logs/route.ts` (role branch + optional tenant filter).

## Acceptance / gate
- `tests/08` A3 flips: SUPER_ADMIN `GET /api/audit-logs?limit=3` → 200 with cross-tenant rows (not 401). Tenant-owner scoping (S-series) unchanged; CASHIER 403 unchanged.
