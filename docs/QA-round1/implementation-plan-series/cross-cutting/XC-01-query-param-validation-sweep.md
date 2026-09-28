# XC-01 — Query-param validation sweep: one shared parser kills the whole "malformed param → 500" family

**Severity:** P2 (12+ individual bugs; one systemic fix) · **Type:** cross-cutting · **Depends on:** INF-02 (error envelope) · **Members:** BUG-28, 32, 40, 45, 51, 74, 75, 81, 82, 84, 89, 91 (module docs M05-04/05, M06-02, M09-01, M10-01, M11-02, M14-02, M17-02, M27-07, M32-01 all reference this)

## Verified source state (2026-09-15) — the family is real and the target list is now exact
Grep of `new Date(searchParams` / `Number(searchParams` / `parseInt(searchParams` across `src/app/api/store/` → **30 call sites in 14 files**. Clamped-or-not:

| File | Params | Naive? |
|---|---|---|
| `customers/route.ts:40-44` | spendMin/Max, page, limit | ❌ unguarded `Number()` → NaN → 500 (BUG-28) |
| `customers/contact-export/route.ts:48` | activeDays | ❌ unclamped |
| `suppliers/route.ts:39-40` | page, limit | ❌ (BUG-32) |
| `expenses/route.ts:38-39` | page, limit | ❌ |
| `purchase-orders/route.ts:44-45` | page, limit | ❌ |
| `bom/produce/route.ts:124` | quantity `Number(?? '0')` | ❌ NaN/float/negative pass |
| `staff/commissions/payouts/route.ts:32-35` | from/to dates | ❌ `new Date()` unvalidated (page/limit clamped) |
| `stock-control/movements/route.ts:57-58` + `~71-74` | page/limit clamped, **from/to dates unvalidated** | ❌ dates (BUG-40) |
| `batches/route.ts:43-44`, `raw-materials/route.ts:40-41`, `low-stock/route.ts:53-54`, `website/products/route.ts:27-28`, `bom/*` | page/limit | ✅ clamped (but `Math.max(1,NaN)=NaN` defeats the clamp on non-numeric — BUG-84/82/81) |

Root pattern: `Number('abc')`/`parseInt('abc')` → `NaN`, and `NaN != null` is **true** and `Math.max(1, NaN)` is **NaN** — so even the "clamped" routes crash on non-numeric input. Dates: `new Date('garbage')` → Invalid Date → Prisma throw.

## Fix approach
1. Build `src/lib/api/query-params.ts` once: `parseQueryInt(name, {default, min, max, onInvalid:'400'|'clamp'})`, `parseQueryNumber`, `parseQueryDate` (ISO + calendar-valid check), `parseQueryBool`. Each returns `{ok, value}` or throws a typed `ApiError` (INF-02) → 400 naming the param.
2. Migrate all 14 files above to the helper (mechanical, one PR per phase group). Decide per-param **400 vs clamp** — the QA pins already encode the *intended* contract: malformed → 400 (customers/suppliers/movements/returns/notifications/low-stock/batches), out-of-range-numeric → clamp (page=0, limit=99999 stay green).
3. Add a Vitest table-driven test per helper; add a repo-wide lint/grep guard in CI (blocklist regex for raw `Number(searchParams`/`new Date(searchParams` in `api/`) so new routes can't reintroduce it.
4. **This is the single highest-leverage doc:** ~12 P3 bugs collapse into one shared module + mechanical migration.

## Files
- new `src/lib/api/query-params.ts`, the 14 route files above, CI grep guard.

## Acceptance / gate
- Every module's pinned 500 (BUG-28/32/40/45/51/74/75/81/82/84/89/91) flips to 400/clamp per its doc; no clamped-edge regressions (page=0/limit=99999 tests stay green).
