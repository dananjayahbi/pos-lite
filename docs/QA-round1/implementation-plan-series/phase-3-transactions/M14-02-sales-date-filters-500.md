# M14-02 — BUG-45: malformed sales date filters (`from=not-a-date`) → unhandled 500

**Severity:** P3-Minor · **Module:** 14 POS/Sales · **QA pin:** `tests/14_pos_billing.spec.ts` C4 · **Depends on:** XC-01 (shared `parseQueryDate`)

## Verified source state (2026-09-15) — still holds
- `src/app/api/store/sales/route.ts:40-41` — `new Date(url.searchParams.get('from')!)` / `to` with no `Number.isNaN(date.getTime())` check → Invalid Date into Prisma → 500 `INTERNAL_SERVER_ERROR`.
- Identical pattern in returns GET (M17-02), movements GET (M09-01) — fix all three with the one helper.

## Fix approach
Use XC-01's `parseQueryDate` → 400 VALIDATION_ERROR naming the param (mirror Module 34's existing correct contract "Invalid date parameters" — OBS-69). No behavior change for valid dates.

## Files
- `src/app/api/store/sales/route.ts`, `src/lib/api/query-params.ts`.

## Acceptance / gate
- `tests/14` C4 flips: malformed range → 400 (not 500); valid filters unchanged.
