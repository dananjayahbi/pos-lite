# M03-03 — BUG-5: `force-logout` returns 200 but the live session survives (fail-open gate + dual caches)

**Severity:** P1-Critical (a security control that silently does nothing) · **Module:** 03 RBAC/Users · **QA pin:** `tests/03_rbac_users.spec.ts` 10.2 · **Depends on:** M01-06 (the middleware fail-closed half)

## Verified source state (2026-09-15) — still holds, two mechanisms
1. **The write side is correct:** `src/app/api/admin/users/[userId]/force-logout/route.ts` — auth (12–17), OWNER/SUPER_ADMIN only (26–28), same-tenant check (43–47), `sessionVersion: { increment: 1 }` (49–56), `clearSessionVersionCacheForUser` (57), audit `FORCE_LOGOUT_TRIGGERED` (59–69).
2. **The consume side fails open:** `middleware.ts:190-212` compares only when *both* versions are numbers; if the bridge call fails/non-OK/null → `dbSessionVersion` stays `null` → comparison skipped → request proceeds. Outer catch (291–296) also `NextResponse.next()` on any error.
3. **Dual caches:** `src/lib/auth/session-version-cache.ts` (Node Map) is cleared by the route; the **Edge** runtime has its own `sessionVersionCache` Map (`middleware.ts:16-17`, 5 s TTL) that the clear never touches — QA's "> wait 5 s" repro window exists precisely because of this split.

## Fix approach
- **Primary fix lives in M01-06** (fail-closed comparison + single-cache strategy). This doc owns the *contract* half:
  1. Define the semantic: after force-logout, the target's next request is rejected within ≤ cache TTL (target: 1 s or zero via the M01-06 chosen strategy). The QA repro ("wait >5 s") must pass with margin.
  2. Force-logout response should include the new `sessionVersion` (or a `revokedAt`) so the admin UI can show certainty.
  3. Rejection lands on `/login?sessionExpired=true` (already the middleware's redirect target — verify the login page banner renders it; page.tsx:67,130–135 says it exists).
- Edge case: force-logout on a user whose JWT is expired anyway → no-op is fine (200).

## Files
- `src/app/api/admin/users/[userId]/force-logout/route.ts` (response field), `src/lib/auth/session-version-cache.ts` + `middleware.ts`/`proxy.ts` (behavior via M01-06), tests only here.

## Acceptance / gate
- `tests/03` 10.2 flips: after force-logout, `GET /customers` as cashier1 → redirected to `/login?sessionExpired=true` (was: still 200).
- Same-tenant owner force-logout → 200; cross-tenant owner → 403; cashier → 403 (test 8.10 already green — must stay).
