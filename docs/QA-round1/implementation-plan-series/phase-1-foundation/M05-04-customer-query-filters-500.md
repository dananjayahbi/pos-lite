# M05-04 — BUG-28: malformed numeric query filters (`spendMin=abc`, `limit=abc`) → 500

**Severity:** P3-Minor (robustness; pollutes error monitoring; no data risk) · **Module:** 05 Customers · **QA pin:** `tests/05_customers.spec.ts` X5 · **Depends on:** XC-01 (shared query-param parser — implement this as its first consumer)

## Verified source state (2026-09-15) — still holds
- `src/app/api/store/customers/route.ts:40-44` GET: `spendMin: searchParams.get('spendMin') ? Number(...) : undefined` (same for `spendMax`/`page`/`limit`) — **no NaN guard**.
- `Number('abc')` → `NaN` reaches the Prisma `totalSpend` filter (`customer.service.ts:250` `gte`) → throws → **500 INTERNAL_SERVER_ERROR**.
- Same class exists in suppliers (M06-02) and ~10 other routes → the shared fix is XC-01; this doc is the customers instance + the pattern-setter.

## Fix approach
1. Use XC-01's `parseQueryInt`/`parseQueryDecimal` helpers (reject NaN/Infinity with a typed 400 VALIDATION_ERROR naming the param, or clamp per documented contract — decision recorded in XC-01; recommend 400 for *malformed*, clamp for *out-of-range* like `page=0`/`limit=99999` which QA P2 already pins as clamped-green).
2. Migrate customers GET to the helper; keep existing clamp semantics for numeric-but-out-of-domain values (QA P2 passes today — don't regress it).

## Files
- `src/app/api/store/customers/route.ts`, `src/lib/api/query-params.ts` (from XC-01).

## Acceptance / gate
- `tests/05` X5 flips: `spendMin=abc` → 400 (not 500); P2 (clamps) stays green.
