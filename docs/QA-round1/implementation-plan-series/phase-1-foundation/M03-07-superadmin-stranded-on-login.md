# M03-07 — BUG-9: SUPER_ADMIN hitting a tenant store route is bounced to `/login`, not `/superadmin/dashboard`

**Severity:** P3-Minor (UX/contract; security outcome is correct — access is denied) · **Module:** 03 RBAC/Users · **QA pin:** `tests/03_rbac_users.spec.ts` 8.5 · **Depends on:** M01-06 (middleware funnel is the intended layer)

## Verified source state (2026-09-15) — still holds
- `middleware.ts:166-174` intends: SUPER_ADMIN on any store path → redirect `/superadmin/dashboard`.
- But `src/app/(store)/settings/users/page.tsx:11-12`: `if (!session?.user?.tenantId) redirect('/login')`. SUPER_ADMIN has `tenantId: null` → the **page guard fires first** and strands the operator on a login form while they hold a valid session (and BUG-17/M01-05 means `/login` shows the form rather than redirecting away — the two bugs compound into "logged in but looking logged out").
- QA observed `307 → /login` for `superadmin@ayurpos.dev` at `/settings/users`.

## Fix approach
1. **Page guards must not assume tenant==authenticated.** The `(store)` pages that require a tenant should, when `!tenantId`, redirect by role: SUPER_ADMIN → `/superadmin/dashboard`, authenticated tenantless-but-not-superadmin → `/login`, unauthenticated → `/login?callbackUrl=…`. Centralize this in the existing guard helper (`src/lib/auth/page-guards.ts` / `requireTenantSession`-style) rather than editing each page — one helper change fixes the class.
2. **Trust the middleware funnel (M01-06) as the primary layer;** the page guard is the defense-in-depth net and should agree with it, not contradict it.
3. Do NOT give SUPER_ADMIN a synthetic tenant — the null tenantId is the correct multi-tenancy signal (tests 8.6/8.7 rely on it).

## Files
- `src/lib/auth/page-guards.ts` (or the shared guard), `src/app/(store)/settings/users/page.tsx`, sweep other `(store)` pages that `redirect('/login')` on `!tenantId` (grep for the pattern) so they route through the helper.

## Acceptance / gate
- `tests/03` 8.5 flips: SUPER_ADMIN at `/settings/users` → `/superadmin/dashboard` (not `/login`).
- CASHIER/DISPATCH denial to `/settings/users` (tests 8.2/8.3/8.4) unchanged; 8.6 cross-tenant 404 unchanged.
