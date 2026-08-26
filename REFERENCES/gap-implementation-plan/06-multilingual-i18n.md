# 06 — Multilingual Support (Sinhala / English / Tamil)

**Module:** M1.2 — Multilingual Support
**Severity:** Medium
**Status:** Not implemented
**Related docs:** [01](./01-product-detail-health-fields.md), [05](./05-sitewide-search.md)

## Issue / Current State

There is no internationalization anywhere in the codebase. A grep for `next-intl` / `i18n` / translation tooling across both `erp/` and `website/` returned zero matches. All user-facing UI strings are hardcoded English.

Metadata hardcodes `locale: 'en_LK'`, so the storefront is English-only at the document level regardless of content. There is no locale routing, no translation catalogs, and no mechanism for bilingual content. This applies to both the customer website (`website/`) and, to a lesser extent, the ERP app (`erp/`).

## Impact

- The majority of the target market is Sinhala-speaking; an English-only storefront excludes them and suppresses conversion.
- The SRS calls for Sinhala/English (and structural support for Tamil). Delivering the health-focused content planned in 01 in English only defeats much of its purpose.
- No i18n infrastructure means every future feature (checkout, tracking, search) will need retrofitting if the foundation is not laid now.

## Implementation Plan

### Step 1 — Introduce i18n infrastructure on the website
Adopt `next-intl` (or an equivalent) in `website/`. Add locale routing (for example, `en` and `si` prefixes, with Tamil structural support planned), configure the app router to provide locale-aware requests, and introduce translation catalogs for `en` and `si`. Update metadata generation to be locale-aware instead of the hardcoded `en_LK`.

### Step 2 — Externalize website UI strings
Replace hardcoded English strings in the shared storefront components — the header (`website/src/components/website/sections/WebsiteHeader.tsx`), footer, shop filter panel (`website/src/components/website/shop/ShopFilters.tsx`), product-detail (`website/src/components/website/product-detail/ProductInfo.tsx`), and checkout (`website/src/components/website/checkout/CheckoutForm.tsx`) — with translation keys. Provide Sinhala translations for all keys.

### Step 3 — Add bilingual product content fields
Support locale-specific product copy. Add bilingual content fields for at least `description` (and the 01 health-content fields) to the `Product` model in `erp/prisma/schema.prisma` — for example, suffixed fields or a structured localized-content model keyed by locale. Update the product service (`erp/src/lib/services/product.service.ts`), the public product API routes under `erp/src/app/api/public/site/[tenantSlug]/products/`, and the ERP product forms under `erp/src/components/product/` to capture and serve the per-locale values. The storefront selects the right locale's copy based on the active locale.

### Step 4 — Locale-aware search (later)
Once keyword search exists (05), ensure the search term matches against the active locale's content fields as well as English.

### Step 5 — Extend to ERP (lower priority)
Apply the same i18n approach to `erp/` structural UI only where it provides operational value, treating this as a lower-priority follow-up that should not block the website rollout.

## Dependencies
- [01](./01-product-detail-health-fields.md) provides the content fields that need bilingual rendering.
- [05](./05-sitewide-search.md) depends on localized content for accurate search.

## Files / Areas affected
- `website/` (locale routing, message catalogs, metadata, storefront components)
- `erp/prisma/schema.prisma` (bilingual content fields on `Product`)
- `erp/src/lib/services/product.service.ts`
- `erp/src/app/api/public/site/[tenantSlug]/products/[productId]/route.ts` and `.../products/route.ts`
- `erp/src/components/product/` (bilingual content entry)
- `website/src/components/website/**` (string externalization)
