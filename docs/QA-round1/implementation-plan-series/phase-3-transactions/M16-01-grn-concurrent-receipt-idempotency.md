# M16-01 — BUG-48: concurrent GRN receipts both return 200; no exactly-once / idempotency contract

**Severity:** P2-Major · **Module:** 16 Purchases/GRN · **QA pin:** `tests/16_purchases_po_grn.spec.ts` (concurrent receive) · **Depends on:** INF-02, XC-06 (race family)

## Verified source state (2026-09-15) — the over-receipt IS guarded, but the duplicate-success ambiguity remains
- `src/lib/services/purchaseOrder.service.ts:245-330` `receivePOLines` runs inside `prisma.$transaction` (251); per-line it checks `received.receivedQty <= 0` (278) and `totalReceived = line.receivedQty + received.receivedQty` vs `orderedQty` → throws on over-receipt (282-285). Batch accumulates (298), stock increments (318), line updated (327).
- **Why QA still saw 2×200:** the pre-check reads `line.receivedQty` at transaction start; two concurrent full-quantity receipts for an ordered-2 line can both read 0 before either commits (REPEATABLE READ/READ COMMITTED don't lock the row until the UPDATE). The final DB state correctly lands at 2 (no over-ingestion, QA confirmed), but one of the two callers *should* have been rejected/conflicted and instead got a success it can't distinguish from the committed one.
- No idempotency key, no row lock, no conflict response.

## Fix approach
1. **Lock the line inside the transaction:** `SELECT … FOR UPDATE` on the `PurchaseOrderLine` before the pre-check (Prisma: `tx.$queryRaw` locking read, or `forUpdate` via interactive transaction raw query). Second concurrent receipt then blocks, re-reads `receivedQty=2`, and fails the over-receipt guard → typed 400/409.
2. **Idempotency (belt):** accept an optional `Idempotency-Key` header (or client receipt ref) and reject a replay of an already-applied receipt with the original result — matches the "double-click the Receive button" reality.
3. Map the over-receipt throw to a typed `OVER_RECEIPT` 409 via INF-02's sentinel registry (today it's a raw Error message).

## Files
- `src/lib/services/purchaseOrder.service.ts` (lock + typed throw), `src/app/api/store/purchase-orders/[id]/receive/route.ts`.

## Acceptance / gate
- `tests/16` concurrent-receive pin flips: two simultaneous full receipts → exactly one 200, one 409 (or serialized-but-correct with the loser rejected), final stock +2 once, one movement/batch increment. Single-receipt happy path + partial/full lifecycle unchanged.
