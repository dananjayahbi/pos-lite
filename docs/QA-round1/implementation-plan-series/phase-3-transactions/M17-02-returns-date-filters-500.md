# M17-02 — BUG-51: malformed return date filters → unhandled 500

**Severity:** P3-Minor · **Module:** 17 Returns · **QA pin:** `tests/17_returns_refunds.spec.ts` (date filters) · **Depends on:** XC-01

## Verified source state (2026-09-15) — still holds
- `src/app/api/store/returns/route.ts:158-159` GET — `new Date(searchParams.get('from')!)` / `to` with no validity check → Invalid Date into the query → catch (170-173) → 500 generic.
- Third instance of the exact pattern (sales M14-02, movements M09-01, returns here) — one shared fix.

## Fix approach
XC-01 `parseQueryDate` → 400 VALIDATION_ERROR naming the param. Bundle all three routes into one commit for consistency (flip three pins together).

## Files
- `src/app/api/store/returns/route.ts`, `src/lib/api/query-params.ts`.

## Acceptance / gate
- `tests/17` date-filter pin flips (400); valid windows unchanged.
