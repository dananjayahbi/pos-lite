# M01-02 — BUG-16: forgot-password limiter is in-memory, fakes success, and writes no audit

**Severity:** P2-Major · **Module:** 01 Auth · **QA pins:** `tests/01_auth.spec.ts` 10.2 / 3.3 (both failed under QA load for this reason) · **Depends on:** nothing (pairs with M01-01)

## Verified source state (2026-09-15) — still holds
- `src/app/api/auth/forgot-password/route.ts:23-26` → `checkRateLimit(ip, 'forgot', 5, 60*60*1000)`.
- `src/lib/rate-limit.ts:18` → the bucket store is a module-level in-memory `Map` (sliding window). It resets on every dev-server restart / cold start and is per-instance (invisible under any horizontal scale).
- When the budget is exhausted the route returns the **same neutral 200** (line ~25) with **no token minted and no `PASSWORD_RESET_REQUESTED` audit row** — QA measured `200 in 16 ms` with zero `verification_tokens` rows.
- `recordFailedAttempt` (line ~28) consumes a slot on every accepted request.

## Why it matters
Legitimate reset requests are silently dropped under normal load (QA burned the budget within one hour across runs). Callers — users *and* monitoring — cannot distinguish "requested" from "suppressed", and the audit ledger undercounts real reset demand.

## Fix approach
1. **Return 429** with a typed envelope (INF-02) and a `Retry-After` header when suppressed. Anti-enumeration is preserved because 429 is IP-scoped, not email-scoped (it says nothing about whether the address exists). Update the QA contract note: tests asserting "unknown email → 200" must send ≤5 requests/minute/IP.
2. **Audit the suppression:** write a `PASSWORD_RESET_THROTTLED` audit row (actor = target user id when resolvable, else null; include IP hash not raw IP if retention concerns). Ops can then see suppressed demand instead of a quiet hole.
3. **Persist the counter (production-grade):** move the forgot-password bucket behind a small interface (`src/lib/rate-limit.ts` already exposes check/record functions — add a DB-backed implementation using a `RateLimitBucket` table or reuse `VerificationToken`-style upsert with window key `ip+date-hour`). In-memory stays as the dev fallback (documented via INF-03-style config flag). Keep the 10-fail/15-min login limiter behavior unchanged here (that budget is a *passing* QA contract, test 8.7) — only the forgot bucket moves.
4. **Per-IP identification hygiene:** behind proxies, derive IP from the first `x-forwarded-for` entry (check current helper; align with the track-endpoint limiter in Module 28 which already does 20/60s).

## Files
- `src/lib/rate-limit.ts` (interface + persistent impl), `src/app/api/auth/forgot-password/route.ts` (429 + audit), `src/lib/services/audit.service.ts` (action constant), Prisma migration only if the DB-bucket table route is chosen.

## Acceptance / gate
- `tests/01_auth.spec.ts`: 6th consecutive burst request → 429 (not 200) + `PASSWORD_RESET_THROTTLED` row visible in `/api/audit-logs`; 10.2/3.3 stop being load-fragile.
- Restarting the dev server does not silently reset the production-mode budget (DB-backed path covered by a Vitest unit test).
