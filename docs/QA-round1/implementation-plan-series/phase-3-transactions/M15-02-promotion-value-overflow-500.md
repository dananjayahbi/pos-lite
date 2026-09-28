# M15-02 — BUG-47: extreme promotion `value` (safe-integer ceiling) reaches Prisma Decimal → 500

**Severity:** P2-Major · **Module:** 15 Promotions · **QA pin:** `tests/15_promotions_pricing.spec.ts` X2 · **Depends on:** INF-02 (fallback), nothing blocking

## Verified source state (2026-09-15) — still holds
- `src/lib/validators/promotion.validators.ts:6` — `value: z.number().min(0)` — **no max, no integer/type bound**. `9007199254740991` passes validation.
- `src/app/api/store/promotions/route.ts` POST: safeParse → create; catch (82-85) returns generic 500 `INTERNAL_ERROR` — typed envelope but still a 500 on what is a client-input error.

## Fix approach
1. Bound by type in the schema: `value` semantics differ per `type` (PERCENTAGE ≤100; FIXED = LKR amount → cap at the Decimal column ceiling; FREE_ITEM qty int). Add `.max()` per branch (superRefine on type) and reject non-safe integers (`Number.isSafeInteger`) up front.
2. INF-02's Prisma mapper (numeric overflow → 400) as the safety net for any future unbounded field.
3. Same sweep while in the file: `minQuantity`, `minAmount`-style numerics get explicit sane maxima (ties to XC-01's coercion theme).

## Files
- `src/lib/validators/promotion.validators.ts`, `promotions/route.ts` (only if a service-side guard preferred over schema).

## Acceptance / gate
- `tests/15` X2 flips: `value: 9007199254740991` → 400 VALIDATION_ERROR naming `value`; valid percentages/amounts unchanged (F-series green).
