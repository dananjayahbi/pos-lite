# M28-04 — BUG-96: `sort=best-selling` is a silent alias for `latest` (stub); storefront residue notes

**Severity:** P3-Minor · **Module:** 28 Storefront · **QA pin:** `tests/28_storefront.spec.ts` X5 · **Depends on:** M28-01 (needs stored lines/sales data to rank), M34 (sales aggregation patterns)

## Verified source state (2026-09-15) — holds
- `src/app/api/public/site/[tenantSlug]/products/route.ts:122-124` — the `best-selling` branch returns `[{ createdAt: 'desc' }]`, identical to `latest`; the code comment (~117-120) admits "we fallback to latest for simplicity". No sales aggregation is wired. QA X5 pins `best-selling ids == latest ids`.

## Fix approach
1. **Real ranking:** order by completed-sale quantity of the product's variants over a rolling window (30/90 d). Data source post-M28-01: `SaleLine` (POS) + `DeliveryLine` (website) — a per-tenant materialized counter is cleaner than a live join on a public endpoint: maintain `Product.popularityScore` (or a `ProductSalesWindow` row) incremented on sale-complete / website-order-paid, decayed by a nightly cron (pattern: existing crons). Cache the ranked id list (s-maxage already exists; a 10-min rebuild is plenty).
2. **Cheap interim option** (if the client wants storefront polish NOW): document `best-selling` in the API response as unsupported and omit the option from the storefront sort UI until the counter exists — better than a silently-wrong sort (currently users think they're seeing top sellers).
3. **Residue notes for the same file** (fix while touching): `_minPrice` internal key stripped (QA verified) — keep; ensure the new ranking path also strips internals; `Cache-Control` retained.

## Files
- `products/route.ts`, popularity counter (new service + increment hooks in sale.service/order.service), nightly decay cron, storefront sort UI (website app `src/app/(site)` consumers).

## Acceptance / gate
- X5 flips: best-selling ≠ latest on fixture data with known sales; empty-sales tenant → deterministic fallback (documented: latest, with an `X-Sort-Fallback` header or response flag); cache headers unchanged.
