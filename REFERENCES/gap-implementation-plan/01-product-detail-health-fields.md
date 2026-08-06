# 01 — Product Detail Health-Content Fields

**Module:** M1 — Customer-Facing Front-End
**Severity:** High
**Status:** Partially implemented
**Related docs:** [03](./03-health-concern-taxonomy.md), [05](./05-sitewide-search.md), [06](./06-multilingual-i18n.md)

## Issue / Current State

The `Product` model (`erp/prisma/schema.prisma`) currently exposes only `name`, `description`, `tags`, and `mainImageUrl` as content-bearing fields. There are no dedicated fields for Ayurvedic health/usage information such as active ingredients, usage/dosage guidance, health benefits, or safety precautions.

The public product-detail page exists and renders correctly — `website/src/app/[tenantSlug]/product/[productId]/page.tsx` loads product data via the public product API and renders it through `website/src/components/website/product-detail/ProductInfo.tsx`. However, `ProductInfo.tsx` only surfaces the `description`, so the page currently conveys no structured clinical/usage detail even when the underlying data may exist in freeform `tags` or `description`.

Because there is no schema support, ERP staff cannot enter this information in the product forms under `erp/src/components/product/`, and the public product API under `erp/src/app/api/public/site/[tenantSlug]/products/[productId]/route.ts` has no fields to return.

## Impact

- Customers shopping for Ayurvedic remedies cannot see how to use a product, what it contains, or safety guidance — the single most important trust signal for this category. This suppresses conversion and increases post-purchase confusion or misuse risk.
- Without structured fields, the data cannot be rendered as clean sections, translated per-language (see 06), or indexed for search (see 05), and staff resort to stuffing prose into `description` and `tags`.
- Loses SEO/detail-page value that competitor herbal stores provide.

## Implementation Plan

### Step 1 — Extend the schema
Add optional scalar fields to `Product` in `erp/prisma/schema.prisma`: `activeIngredients` (freeform text list or string array), `usageInstructions` / `dosageGuidelines`, `healthBenefits`, and `safetyPrecautions`. Keep them nullable for backward compatibility with existing rows. Generate and apply the migration so existing products remain valid.

### Step 2 — Update the ERP service layer
Extend the product service (`erp/src/lib/services/product.service.ts`) create/update/read logic so the new fields are persisted and returned. Update the public product-detail route (`erp/src/app/api/public/site/[tenantSlug]/products/[productId]/route.ts`) to include the new fields in its response payload.

### Step 3 — Build ERP management UI
Extend the product create/edit forms under `erp/src/components/product/` with labeled inputs (multi-line text areas) for active ingredients, usage instructions, health benefits, and safety precautions. Keep these fields distinct from the existing `description` field to preserve their structured nature.

### Step 4 — Render structured sections on the storefront
Refactor `website/src/components/website/product-detail/ProductInfo.tsx` to render the four new fields as clearly separated, styled sections (for example, "Active Ingredients", "How to Use", "Benefits", "Precautions"), only when the field is populated. Add appropriate iconography/labeling consistent with the existing product-detail component.

## Dependencies
- [03](./03-health-concern-taxonomy.md) for a related taxonomy that may reuse the same content model.
- [06](./06-multilingual-i18n.md) for rendering bilingual versions of these content fields.

## Files / Areas affected
- `erp/prisma/schema.prisma` (model `Product`)
- New migration under `erp/prisma/migrations/`
- `erp/src/lib/services/product.service.ts`
- `erp/src/app/api/public/site/[tenantSlug]/products/[productId]/route.ts`
- `erp/src/components/product/` (create/edit forms)
- `website/src/app/[tenantSlug]/product/[productId]/page.tsx`
- `website/src/components/website/product-detail/ProductInfo.tsx`
