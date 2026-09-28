# M08-01 — BUG-35: tenant suspension is not enforced end-to-end (corrected scope: gates exist but leak; login + API paths missing)

**Severity:** P1-Critical (primary multi-tenant enforcement — non-payment → suspension — is a no-op in the live paths that matter) · **Module:** 08 Super Admin · **QA pin:** `tests/08_superadmin_tenants.spec.ts` B1 · **Depends on:** M01-06 (middleware hardening — implement first) · **Related:** REQ-12 (export/audit stubs), OBS-16

## Verified source state (2026-09-15) — QA's headline is now PARTIALLY STALE; the real holes are these
QA (on the old checkout) said "no enforcement anywhere; `/suspended` doesn't exist." Current source:
- `src/app/suspended/page.tsx` **exists** (static informational screen; reads session but gates nothing).
- `middleware.ts:234-254` **has** a suspension gate → redirects non-SUPER_ADMIN to `/suspended` when `checkTenantStatus` says SUSPENDED.
The enforcement still fails for three concrete reasons:
1. **API bypass:** `isSuspensionBypassPath` (middleware.ts:65-74) skips the check for **all `/api/` paths** → a suspended tenant's already-loaded SPA keeps full data access indefinitely (QA B1 reproduced exactly this).
2. **No login gate:** `src/lib/auth.ts` `authorize()` (33-131) checks user `isActive` but **never tenant status** → suspended users mint fresh JWTs freely.
3. **Fail-open bridge:** non-OK bridge response → `if (res.ok)` skips the check (M01-06 fix #4 covers the mechanism; NEW-B 400-on-missing-tenantId).
Also: no page-level guard in `(store)/layout.tsx` (auth-only, lines 11-20) — defense-in-depth absent if middleware is ever bypassed (e.g. matcher gaps).

## Fix approach
1. **Login gate (primary):** in `authorize()`, after the user check, load tenant status (user.tenantId → Tenant.status); if `SUSPENDED` (or `CANCELLED` — decide policy; grace period = allow) → return null with a distinct error code `TENANT_SUSPENDED` → login page maps it ("Your account is suspended — contact support") and/or redirects `/suspended`. Audit `LOGIN_FAILED_TENANT_SUSPENDED`.
2. **API enforcement:** per M01-06 step 4 — check tenant status for `/api/store/*` (and `/api/billing/*`?) with the 5s-cache bridge; SUSPENDED → 403 JSON `{code:'TENANT_SUSPENDED'}`; keep webhooks/public/auth/cron/internal exempt (documented list).
3. **Page guard (defense-in-depth):** `(store)/layout.tsx` — cheap cached status read server-side; SUSPENDED → redirect `/suspended`. (Middleware should catch it first; this is the safety net QA's own architecture notes recommend.)
4. **`/suspended` honesty:** make it tenant-aware (verify caller's tenant IS suspended; show billing support info; "Back to Login" only for sessionless).
5. Grace-period (`GRACE_PERIOD`) semantics: allow app + show banner? QA observes badge flips; product decision — recommend allow with a warning banner (out of this doc's scope to design the banner; record the decision).

## Files
- `src/lib/auth.ts`, `middleware.ts` (with M01-06), `src/app/(store)/layout.tsx`, `src/app/suspended/page.tsx`, login page error map, audit constants.

## Acceptance / gate
- `tests/08` B1 flips: suspend tenant2 → its owner's login attempt rejected; existing session's `GET /api/store/customers` → 403; page nav → `/suspended`; reactivate → all restored (A2 double-suspend idempotence stays green).
