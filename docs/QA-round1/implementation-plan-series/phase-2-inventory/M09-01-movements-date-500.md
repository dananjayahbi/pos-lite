# M09-01 — BUG-40: malformed `from`/`to` date params on the movements ledger → unhandled 500

**Severity:** P3-Minor · **Module:** 09 Stock Movements · **QA pin:** `tests/09_stock_movements.spec.ts` T1 · **Depends on:** XC-01 (shared param parser — date helpers)

## Verified source state (2026-09-15) — still holds
- `src/app/api/store/stock-control/movements/route.ts:71-73` — `if (from) where.createdAt.gte = new Date(from); if (to) …lte = new Date(to);` — no `isNaN`/format check. `?from=not-a-date` → Invalid Date → Prisma throws → 500 `INTERNAL_ERROR`. Both the CSV export (~113) and paginated query (~160) consume the same `where`.
- `page`/`limit` (54-55) already have `Number()`+clamp guards — only dates are unvalidated.
- Well-formed-but-impossible dates (`2026-02-30`) silently roll over to Mar 2 → 200 (QA pinned as current behavior).
- Contrast: Module 34's report routes validate dates and return 400 "Invalid date parameters" (OBS-69 — the stricter template; copy that contract).

## Fix approach
1. Use XC-01's `parseQueryDate` (coerce + `isNaN` → 400 VALIDATION_ERROR naming the param). Decide rollover: reject `2026-02-30` too (strict ISO `z.coerce.date()` with calendar check) — recommend reject, matching reports.
2. Apply to the movements route; sweep siblings in the same session: sales GET (M14-02), returns GET (M17-02) share the identical pattern — one helper, three call sites, flip three pins consistently.

## Files
- `src/app/api/store/stock-control/movements/route.ts`, `src/lib/api/query-params.ts` (XC-01).

## Acceptance / gate
- `tests/09` T1 flips: `from=not-a-date` → 400; Feb-30 → 400 (or documented accept); valid windows + future-window-empty stay green.
