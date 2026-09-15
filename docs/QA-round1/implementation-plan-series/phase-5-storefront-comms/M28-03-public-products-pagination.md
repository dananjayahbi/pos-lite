# M28-03 — BUG-95: public products endpoint has NO pagination (`page`/`offset` silently ignored → catalogs >50 unreachable)

**Severity:** P2-Major · **Module:** 28 Storefront · **QA pin:** `tests/28_storefront.spec.ts` X4 · **Depends on:** nothing · **Blocks:** REQ-05 storefront catalog

## Verified source state (2026-09-15) — holds
- `src/app/api/public/site/[tenantSlug]/products/route.ts` — fetches ALL matching products with no take/skip (comment ~131-132: "no `take` here — price filtering is done in memory"), then `priceFiltered.slice(0, limit)` (206). `?page=2` returns page 1. `limit` clamps 1..50 (QA-verified) → products beyond the first 50 are unreachable from the storefront.
- The in-memory price-window filter (`priceMin/priceMax`) is *why* they avoided DB pagination — the fix must preserve that behavior.

## Fix approach
1. Push the price window into the SQL `where` (`retailPrice gte/lte` on the primary-variant aggregate — the route already computes `_minPrice` per product; either filter in a `HAVING`-style via a join or keep the two-step: query ids with a filtered aggregate). If the cheapest correct route is "filter in memory then paginate the filtered ids", do that but **cache the filtered id list per tenant+filter-signature** (the feed is already `Cache-Control: s-maxage=60`-cached — 50-item slices of a cached list are cheap).
2. Accept `page` (≥1, safe-int guard per XC-01) + return `total` = filtered count + `hasMore` — envelope parity with the ERP list routes so the storefront UI (REQ-05) can build paging.
3. Keep `createdAt`-desc default + price sorts working across pages (sort before slice — already true at 200-204).

## Files
- `products/route.ts`, shared cache helper, `tests/28` X4.

## Acceptance / gate
- X4 flips: `?page=2` returns a disjoint, correctly-ordered window; `total` stable across pages; the 60 s cache header retained; filters (category/brand/form/concern/q) paginate consistently.
