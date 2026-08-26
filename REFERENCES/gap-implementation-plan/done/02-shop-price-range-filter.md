# 02 — Shop Price-Range Filter

**Module:** M1 — Customer-Facing Front-End
**Severity:** Medium
**Status:** Not implemented
**Related docs:** [04](./04-shop-form-filter.md), [03](./03-health-concern-taxonomy.md), [05](./05-sitewide-search.md)

## Issue / Current State

The storefront shop filter panel, `website/src/components/website/shop/ShopFilters.tsx`, currently offers only category pills and a sort control. There is no way for customers to filter the product catalog by price.

The public products API, `erp/src/app/api/public/site/[tenantSlug]/products/route.ts`, supports filtering by category and brand plus four sort orders, but has no `priceMin` / `priceMax` query parameters. Consequently price filtering cannot be expressed at the data layer at all.

## Impact

- Customers cannot narrow results to a budget, which is a common purchasing behaviour for herbal/wellness products. Without it the shop is harder to browse and conversion on price-sensitive visitors drops.
- Every category pill currently returns the full price range, so users on budget must page through many irrelevant products.

## Implementation Plan

### Step 1 — Add price range to the public API
Extend `erp/src/app/api/public/site/[tenantSlug]/products/route.ts` to accept optional `priceMin` and `priceMax` query parameters. Filtering should be applied in the query layer against the variant retail price. The comparison price should be decided once at the query layer (for example, the lowest available variant price per product) so the filter is deterministic across the catalog.

### Step 2 — Add price controls to the shop filter panel
Extend `website/src/components/website/shop/ShopFilters.tsx` with a price-range control — either paired min/max number inputs or a dual-handle range slider. The control should emit `priceMin` / `priceMax` into the existing query-state used by the shop page, defaulting to the catalog's observed min/max price bounds.

### Step 3 — Derive and display bounds
Add a small helper (in the shop data layer under `website/src/lib/api/`) that computes the minimum and maximum retail price from the loaded catalog, used to seed the slider limits. Keep this in the website data layer so the control stays in sync with what the API can actually return.

### Step 4 — Wire and verify combination behaviour
Ensure the price filter composes correctly with the existing category pills, sort, and any future filters (form filter in 04, health concern in 03). Reset behaviour, empty-result messaging, and URL query-state persistence should be handled consistently with the current shop implementation.

## Dependencies
- [04](./04-shop-form-filter.md) and [03](./03-health-concern-taxonomy.md) extend the same shop filter panel and should share its query-state model.
- [05](./05-sitewide-search.md) reuses the same product query route.

## Files / Areas affected
- `erp/src/app/api/public/site/[tenantSlug]/products/route.ts`
- `website/src/components/website/shop/ShopFilters.tsx`
- `website/src/lib/api/` (shop data layer / helper for price bounds)
- Shop page component(s) under `website/src/app/[tenantSlug]/` that own filter query-state
