# 04 — Shop Product-Type / Form Filter

**Module:** M1 — Customer-Facing Front-End
**Severity:** Medium
**Status:** Not implemented
**Related docs:** [02](./02-shop-price-range-filter.md), [03](./03-health-concern-taxonomy.md), [05](./05-sitewide-search.md)

## Issue / Current State

`ProductVariant` (`erp/prisma/schema.prisma`) already carries a `form String?` field that captures the product type (for example, Powder, Capsule, Tablet, Oil). This value is populated and part of the variant model, but the website shop does not use it as a filter.

The public products API (`erp/src/app/api/public/site/[tenantSlug]/products/route.ts`) filters only by category, brand, and sort. The shop filter panel, `website/src/components/website/shop/ShopFilters.tsx`, exposes category pills and sort but no form/type control.

## Impact

- Customers who know they want a specific format (for example, a capsule rather than a loose powder) cannot isolate it, forcing manual scanning of the catalog.
- Existing structured data (`form`) is collected but never monetized for discovery, leaving a cheap, high-value filter on the table.

## Implementation Plan

### Step 1 — Add form filtering to the public API
Extend `erp/src/app/api/public/site/[tenantSlug]/products/route.ts` with a `form` query parameter that filters products by the `form` value of their variants. Apply the filter at the query layer in a way that composes with category, brand, and sort. Decide and document how a product with multiple variant forms is matched (for example, include the product if any of its variants matches).

### Step 2 — Expose distinct forms to the storefront
Add the distinct set of `form` values in the public products API response (or a small companion endpoint) so the storefront can render the filter from the actual catalog rather than a hardcoded list.

### Step 3 — Add the form filter control
Extend `website/src/components/website/shop/ShopFilters.tsx` with a form/type filter control (for example, a set of pills or a select) populated from the distinct forms. Route its state through the shared shop query-state model so it composes and resets with the category, sort, price (02), and concern (03) filters.

### Step 4 — Verify combination and empty states
Confirm the form filter composes with the other filters and the sort. Ensure empty-result messaging matches the existing shop behaviour when the combination yields no products.

## Dependencies
- [02](./02-shop-price-range-filter.md) and [03](./03-health-concern-taxonomy.md) share the same filter panel and query-state model.

## Files / Areas affected
- `erp/src/app/api/public/site/[tenantSlug]/products/route.ts`
- `website/src/components/website/shop/ShopFilters.tsx`
- `website/src/lib/api/` (shop data layer)
- Shop page component(s) under `website/src/app/[tenantSlug]/` that own filter query-state
