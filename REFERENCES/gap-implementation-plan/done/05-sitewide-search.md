# 05 — Sitewide Product Search

**Module:** M1 — Customer-Facing Front-End
**Severity:** High
**Status:** Not implemented
**Related docs:** [01](./01-product-detail-health-fields.md), [03](./03-health-concern-taxonomy.md), [02](./02-shop-price-range-filter.md)

## Issue / Current State

There is no sitewide keyword search anywhere on the storefront. Neither the site header (`website/src/components/website/sections/WebsiteHeader.tsx`) nor the shop page provides a search box. Users can only navigate by fixed categories, brand, and sort.

The public products API (`erp/src/app/api/public/site/[tenantSlug]/products/route.ts`) has no `q` / `search` keyword parameter, so there is no text-based lookup to back a search feature even if a UI existed.

## Impact

- Returning customers and customers who know a specific product name cannot find it quickly; they must drill through categories manually.
- Text search is a primary acquisition and retention mechanism for a storefront. Its absence is a significant usability and conversion gap.
- Future content fields (see 01) and the health-concern taxonomy (03) add searchable surface area that currently cannot be exploited.

## Implementation Plan

### Step 1 — Add keyword search to the public API
Extend `erp/src/app/api/public/site/[tenantSlug]/products/route.ts` with a `q` (or `search`) query parameter. Implement a case-insensitive substring match against `Product.name`, `Product.description`, `Product.tags`, and — once added (01) — the structured content fields. Apply the match in the query layer and compose it with the existing category/brand/sort filters.

### Step 2 — Add a search input to the site header
Add a search input to `website/src/components/website/sections/WebsiteHeader.tsx`. Submitting it should route to the shop page with the query term set in the shop query-state (or to a dedicated results view).

### Step 3 — Render search results
Support the search term in the shop page so the existing product grid renders results for the query, reusing the same card components. Optionally add a lightweight "results for ..." header and empty-state messaging distinct from the unfiltered shop.

### Step 4 — Index optimization (optional / later)
If result quality or latency becomes a concern, consider a dedicated text index or a search-backed endpoint rather than raw substring scans. Keep this behind the same query route so the storefront contract is unchanged.

## Dependencies
- [01](./01-product-detail-health-fields.md) adds fields worth indexing.
- [03](./03-health-concern-taxonomy.md) can provide faceted search later.

## Files / Areas affected
- `erp/src/app/api/public/site/[tenantSlug]/products/route.ts`
- `website/src/components/website/sections/WebsiteHeader.tsx`
- `website/src/lib/api/` (shop data layer)
- Shop page component(s) under `website/src/app/[tenantSlug]/`
