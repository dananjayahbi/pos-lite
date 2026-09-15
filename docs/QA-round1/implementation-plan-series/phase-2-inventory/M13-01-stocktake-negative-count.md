# M13-01 — BUG-42: stock-take item PATCH accepts negative (and non-integer) counted quantities

**Severity:** P2-Major · **Module:** 13 Stock Takes · **QA pin:** `tests/13_stock_takes.spec.ts` P2 · **Depends on:** nothing

## Verified source state (2026-09-15) — still holds
- `src/app/api/store/stock-control/stock-takes/[sessionId]/items/[itemId]/route.ts` PATCH: body is raw-cast (41-43), and the `countedQuantity` branch (66-69) does `updateData.countedQuantity = body.countedQuantity; updateData.discrepancy = body.countedQuantity - currentItem.systemQuantity` — **no zod, no `>=0`/integer check** — a negative count is written via `prisma.stockTakeItem.update` (77) and can flow into the approval→stock-correction path.

## Fix approach
1. Add a `StockTakeItemUpdateSchema` (int, `>=0`, plus the other mutable fields — recount flag etc. if present) and `safeParse` in the PATCH → 400 VALIDATION_ERROR on negative/float/NaN/string.
2. Recompute `discrepancy` from the validated value (keep the formula).
3. Client-side: the count input should set `min={0}` + integer step (mirror the API), so operators get inline guidance, not just a 400.
4. This is the same "no zod on a PATCH" class as OBS-82/M07-03 and BUG-42's siblings — fold the validator into the shared stock-take validators file.

## Files
- `src/app/api/store/stock-control/stock-takes/[sessionId]/items/[itemId]/route.ts`, `src/lib/validators/` (stock-take schema), the item-count input component.

## Acceptance / gate
- `tests/13` P2 flips: `countedQuantity:-1` → 400, discrepancy unchanged; valid counts still persist (item-update tests green).
