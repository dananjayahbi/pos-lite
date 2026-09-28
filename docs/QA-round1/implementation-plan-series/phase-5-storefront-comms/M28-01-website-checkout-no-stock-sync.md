# M28-01 — BUG-97: website checkout NEVER decrements stock and stores NO line items — req 3.2 two-way sync is half-implemented (guaranteed overselling)

**Severity:** P1-Critical · **Module:** 28 Storefront · **QA pin:** `tests/28_storefront.spec.ts` L2 · **Depends on:** M25 (rate engine for fee), INF-02 · **Blocks:** REQ-05

## Verified source state (2026-09-15) — still holds, worse than "no stock sync"
- `src/lib/services/order.service.ts:30-118` `createWebsiteOrder` creates only: a `Delivery` (source `WEBSITE_CHECKOUT`, status `PLACED`), a `ShippingAddress` snapshot, a `DeliveryEvent`. It **never reads `input.lines`** (the checkout validator accepts `lines: z.array(CheckoutLineSchema).max(200).optional()` at `checkout.validators.ts:34` — silently ignored). No `SaleLine` rows; there is **no `DeliveryLine` model in the schema at all**. No `ProductVariant.stockQuantity` decrement (grep: zero hits for `input.lines|saleLine|stockQuantity` in order.service.ts).
- Stored totals are **client-supplied scalars**: `codAmount = input.codAmount ?? 0` (:63), `itemCount = input.itemCount ?? 1` — so the ERP records whatever the browser claims, with no server-side price/quantity recomputation.
- QA L2 pinned: order for 2 units → public feed stock UNCHANGED → overselling guaranteed; pos→site direction works (adjust visible), site→pos does not exist.

## Fix approach (the biggest single doc in this cluster — split tasks internally)
1. **Server-side line integrity:** in `createWebsiteOrder`, validate every line: variant exists, belongs to the tenant, is live (product not archived/deleted, `stockQuantity` sufficient); compute `codAmount`/`itemCount`/weight **server-side** from `variant × quantity` (Decimal math, INF-04) — reject client-sent totals or ignore them (recommend ignore, like `createdAt` forgery handling everywhere else).
2. **Persist lines.** Schema decision needed: (a) add a `DeliveryLine` model (variantId, qty, unitPrice snapshot, lineTotal) linked to Delivery — clean, mirrors SaleLine; or (b) reuse `Sale`+`SaleLine` with a WEBSITE source flag — heavier (shiftless sale, payment semantics). **Recommend (a)** + a migration; the POS-sale path stays separate. Tracking/labels/reconciliation read Delivery, not Sale, so (a) fits the existing flow.
3. **Stock decrement, reservation semantics:** reserve stock at order creation via the shared `adjustStockInTx`-style helper with a new `StockMovementReason` (e.g. `WEBSITE_ORDER`) so the ledger stays the source of truth (module 09's contract); cancellation/restock reverses it (the PLACED→CANCELED cleanup path QA used). Concurrency: the decrement must be inside the order-create transaction with an atomic `decrement` + a `stockQuantity >= qty` guard (409 `OUT_OF_STOCK`, same shape as `INSUFFICIENT_STOCK` in BOM production, module 22).
4. **Oversell policy:** reserve-on-order means abandoned checkouts hold stock — add a hold-expiry (e.g. PLACED older than N hours auto-cancels via the existing `clear-held-deliveries` cron pattern, module 24 inspect paths) — client decides N; default 24 h.
5. Public product feed then reflects decrements automatically (site→pos direction complete = req 3.2 satisfied both ways).

## Files
- `order.service.ts`, `checkout.validators.ts` (strict lines), new `DeliveryLine` model + migration, `StockMovementReason` enum, delivery cancel route (restock), held-order cron.

## Acceptance / gate
- L2 flips: order 2 units → stock −2, lines stored, feed shows reduced stock; cancel → restored; concurrent last-unit race → exactly one 201 + one 409; server ignores forged `codAmount`. tests/28 checkout + tracking series green; req 3.2 "real-time two-way stock sync" ticked.
