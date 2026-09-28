# M06-02 — BUG-32: non-numeric `page`/`limit` query params → 500

**Severity:** P3-Minor (robustness; same class as M05-04) · **Module:** 06 Suppliers · **QA pin:** `tests/06_suppliers.spec.ts` X4 · **Depends on:** XC-01 (shared query-param parser)

## Verified source state (2026-09-15) — still holds
- `src/app/api/store/suppliers/route.ts:38-39` GET: `page: … ? Number(searchParams.get('page')) : undefined` (same for `limit`) — no NaN guard.
- `supplier.service.ts:132-133` clamps with `Math.max(1, options.page ?? 1)` / `Math.min(100, Math.max(1, options.limit ?? 20))` — but `Math.max(1, NaN)` → `NaN`, so `skip=(NaN-1)*limit` → NaN reaches Prisma → **500**.
- Numeric edge values (page=0, -5, limit=0, 99999) are correctly clamped (QA F7 green) — only *non-numeric* crashes.

## Fix approach
Route the suppliers GET through XC-01's query helpers: non-numeric → 400 VALIDATION_ERROR naming the param; numeric-but-out-of-domain → existing clamp (keep F7 green). Same pattern as M05-04; the two docs share the helper, first-writer builds it.

## Files
- `src/app/api/store/suppliers/route.ts`, `src/lib/api/query-params.ts` (XC-01).

## Acceptance / gate
- `tests/06` X4 flips: `page=abc`/`limit=abc` → 400 (not 500); F7 clamps stay green.
