# 03 — Health-Concern Taxonomy & Filter

**Module:** M1 — Customer-Facing Front-End
**Severity:** High
**Status:** Not implemented
**Related docs:** [01](./01-product-detail-health-fields.md), [04](./04-shop-form-filter.md), [05](./05-sitewide-search.md)

## Issue / Current State

There is no structured "health concern / need" taxonomy anywhere in the system. The `Product` model (`erp/prisma/schema.prisma`) carries a freeform `tags String[]`, and the shop is browsable only by `Category` and `Brand`.

Customers shopping by need (for example, "Joint Pain", "Skin Care", "Digestive Health", "Stress Relief") have no supported way to discover products, because nothing in the schema, the public products API (`erp/src/app/api/public/site/[tenantSlug]/products/route.ts`), or the shop filter UI (`website/src/components/website/shop/ShopFilters.tsx`) understands this dimension.

## Impact

- Health-concern browsing is the natural entry point for an Ayurvedic customer, yet it is impossible. Category-based browsing is generic and does not map cleanly to symptom/need-based discovery.
- Reliance on freeform `tags` prevents consistent, curated navigation and cannot power a dedicated filter control, landing pages, or targeted merchandising.

## Implementation Plan

### Step 1 — Define the taxonomy in the schema
Introduce a curated `HealthConcern` concept. Keep it modular and consistent with the existing `Category`/`Brand` pattern — either a dedicated `HealthConcern` model with a join table (`ProductConcern`) or, if the taxonomy must stay lightweight, a constrained enum applied as a string array on `Product`. Prefer a managed model/enum so values are consistent and enumerable for filtering. Add the necessary `@@index` for the storefront filter lookup.

### Step 2 — Build ERP management UI
Add a management surface so staff can assign health concerns to products. If a managed model is used, add a small maintenance UI (create/rename/retire concerns) plus a multi-select on the product form under `erp/src/components/product/`. If an enum is used, add a multi-select against the fixed enum values. Expose the list of concerns in the service layer (`erp/src/lib/services/product.service.ts` or a dedicated concern service).

### Step 3 — Support filtering in the public API
Extend `erp/src/app/api/public/site/[tenantSlug]/products/route.ts` with a concern filter query parameter, and add a public endpoint (or extend an existing config route under `erp/src/app/api/public/site/[tenantSlug]/`) that returns the curated list of concerns so the storefront can render the filter.

### Step 4 — Add the storefront filter UI
Extend `website/src/components/website/shop/ShopFilters.tsx` with a health-concern filter control that lists the concerns returned from the public API and composes with the existing category/brand/sort filters. Keep the filter state in the shared shop query-state model so it persists and resets consistently with the other filters.

## Dependencies
- [01](./01-product-detail-health-fields.md) — the concern assignment can coexist with, and be surfaced within, the product-detail content model.
- [04](./04-shop-form-filter.md) and [02](./02-shop-price-range-filter.md) extend the same filter panel and query-state.
- [05](./05-sitewide-search.md) can leverage the taxonomy for grouped search facets.

## Files / Areas affected
- `erp/prisma/schema.prisma` (new `HealthConcern` / `ProductConcern` models or enum on `Product`)
- New migration under `erp/prisma/migrations/`
- `erp/src/lib/services/product.service.ts` (or a new concern service)
- `erp/src/app/api/public/site/[tenantSlug]/products/route.ts`
- `erp/src/components/product/` (concern assignment UI)
- `website/src/components/website/shop/ShopFilters.tsx`
- `website/src/lib/api/` (shop data layer)
