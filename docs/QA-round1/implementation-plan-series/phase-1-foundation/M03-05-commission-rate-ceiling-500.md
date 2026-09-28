# M03-05 — BUG-7: out-of-range `commissionRate` returns HTTP 500 instead of 400

**Severity:** P2-Major · **Module:** 03 RBAC/Users · **QA pins:** `tests/03_rbac_users.spec.ts` 2.2, 9.3 · **Depends on:** INF-02 (defense-in-depth mapping), nothing blocking otherwise

## Verified source state (2026-09-15) — still holds
- `src/lib/validators/staff.validators.ts:11-15` (create) / `:22-26` (update): `z.string().regex(/^\d+(\.\d{1,2})?$/, …)` — **shape only**; `"99999"`, `"1000.00"`, `"99999999999999999999"` all pass.
- `src/lib/services/staff.service.ts:116,188`: `parseFloat(...)` straight into Prisma.
- `prisma/schema.prisma:452`: `commissionRate Decimal? @db.Decimal(5, 2)` → max **999.99** → numeric overflow throws → route catch maps only its two known messages → **500**.
- Business question: a *commission rate* above 100 is almost certainly invalid even though the column could store up to 999.99. QA's own precision tests (2.1/2.3) treat 0.01–99.99 as the valid domain.

## Fix approach
1. **Schema bound:** add `.refine` on the commission string: numeric value must be `0 ≤ x ≤ 100` with ≤2 decimals (message: "Commission rate must be between 0 and 100"). Apply to both Create and Update schemas. (If the team wants 999.99 headroom, still cap at the Decimal ceiling — the 500 must become a 400 either way; record the chosen bound in the PR. Recommend 0–100: a percentage.)
2. **Defense-in-depth:** INF-02's Prisma mapper converts any residual numeric overflow into a typed 400/422 instead of 500 — this doc doesn't depend on it, but the family fix catches future regressions.
3. Keep the existing 2-dp round-trip behavior (tests 2.1/2.3 green — `5.00/12.50/0.01/99.99/7` accepted, no float drift, value survives role change).

## Files
- `src/lib/validators/staff.validators.ts` (+ its Vitest file under `src/lib/__tests__/` if present — validators have unit tests on this branch).

## Acceptance / gate
- `tests/03` 2.2 flips: `1000.00` → 400 VALIDATION_ERROR with `path` in details (same error family as test 1.3's cases). 9.3 flips: the giant digit string → 400 (was `[400,201]`-style chaos).
