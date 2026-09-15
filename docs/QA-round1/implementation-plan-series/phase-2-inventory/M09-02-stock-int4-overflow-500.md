# M09-02 — BUG-41: stock add that overflows int4 → unhandled 500 (no upper-bound guard on `quantityDelta`)

**Severity:** P3-Minor (clean rollback, no corruption; typed-error gap) · **Module:** 09 Stock Movements · **QA pin:** `tests/09_stock_movements.spec.ts` X4 · **Depends on:** nothing

## Verified source state (2026-09-15) — still holds
- `src/app/api/store/stock-control/adjust/route.ts:60-67` — `const newQty = variant.stockQuantity + quantityDelta; if (newQty < 0) throw 'BELOW_ZERO…'` (61) then `stockQuantity: { increment: quantityDelta }` (67). **No upper bound.** A delta whose sum exceeds 2,147,483,647 → Postgres integer-out-of-range inside the transaction → 500 `INTERNAL_ERROR` (rollback clean: stock unchanged, no ledger row).
- `bulk-adjust/route.ts:120-129` — identical pattern (guard at 121, increment at 129).
- Boundary proof from QA: `delta = INT_MAX − 173` → 200 (stock hits exactly INT_MAX); +1 more → 500. Symmetric below-zero case IS typed (400) — only the ceiling is missing.

## Fix approach
1. Add `if (newQty > 2_147_483_647) throw` with a typed 400 message mirroring BELOW_ZERO ("Adjustment would exceed the maximum stock quantity") in **both** adjust and bulk-adjust paths (bulk: per-row check inside validation, 422 batch-style like BELOW_ZERO_STOCK with SKU).
2. Also bound the raw delta itself in the schema (`z.number().int().abs().lte(1_000_000)` — a business-sane cap; document the chosen ceiling) so absurd values fail validation before touching the DB.
3. Reuse the same constant in M21 (raw-material adjust shares the shape) if the validator is shared.

## Files
- `src/app/api/store/stock-control/adjust/route.ts`, `bulk-adjust/route.ts`, `src/lib/validators/product.validators.ts` (StockAdjustmentSchema ~164-169).

## Acceptance / gate
- `tests/09` X4 flips: INT_MAX-scale delta → 400 (not 500); boundary add to INT_MAX−1… decision: cap at a sane max means that pin also changes to 400 — align with the client-chosen ceiling; below-zero stays 400; ledger chain L1 unaffected.
