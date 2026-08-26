# Website Module — Implementation Status

Date: 2026-08-06
This document records which audit findings were fixed in the implementation pass, and any notes for operations.

## Resolved

| Finding | Fix | Files |
|---|---|---|
| 1.1 / 1.4 / 1.5 / 3.3 (hero slides lost on save) | The config save now reconciles hero slides and ads against their dedicated relation rows (full replace in a transaction). The storefront's source of truth is preserved; incomplete slides/ads are skipped rather than failing the save; null ad dates are normalized. | `erp/src/app/api/store/website/route.ts`, `erp/src/lib/services/website.service.ts` |
| 1.2 / 3.4 (Reset broken) | Added a DELETE handler on the config route backed by a reset service that clears the config JSON and removes all hero slides/ads, then revalidates the storefront. | `erp/src/app/api/store/website/route.ts`, `erp/src/lib/services/website.service.ts` |
| 1.3 (missing migrations) | Added a migration that creates `website_configs`, `website_hero_slides`, and `website_ads` (tables, indexes, FKs). | `erp/prisma/migrations/20260806000000_add_website_module_tables/migration.sql` |
| 2.1 (stale category counts) | Product/variant/bulk/import mutations now also purge the catalog tags (`categories`/`brands`). | `erp/src/app/api/store/products/**` |
| 2.2 (stock after orders) | The public order route purges the tenant/product/catalog caches after a website order is committed. | `erp/src/app/api/public/site/[tenantSlug]/orders/route.ts` |
| 2.3 (revalidate false-success) | The website revalidation endpoint now returns a non-2xx with a list of failed tags/paths when any purge fails. | `website/src/app/api/revalidate/route.ts` |
| 2.5 (ISR inconsistency) | Checkout is now explicitly `force-dynamic`. | `website/src/app/[tenantSlug]/checkout/page.tsx` |
| 2.6 (default-tenant paths) | The revalidation helper now always purges the root path. | `erp/src/lib/revalidate-website.ts` |
| 2.7 (single-category fetch) | Added a public single-category endpoint; the storefront category page now uses it instead of fetching the full list. | `erp/src/app/api/public/site/[tenantSlug]/categories/[categoryId]/route.ts`, `website/src/lib/api/categories.ts` |
| 3.1 (loose sections validation) | Added per-section zod schemas for all 9 current sections; malformed section shapes are now rejected at save. | `erp/src/lib/validators/website.validators.ts` |
| 3.2 (default-merge wipes defaults) | The form deep-merges the loaded config over its defaults so nested section/social/footer defaults are preserved. | `erp/src/components/settings/WebsiteSettingsForm.tsx` |
| 3.5 (orphaned components) | Removed the unused/orphaned tabs and unused storefront section components and brand helper. | `erp/src/components/settings/website-tabs/*`, `website/src/components/website/sections/*`, `website/src/lib/api/brands.ts` |
| 3.6 (preview shell gaps) | The ERP preview shell now renders all 9 current sections, including new lightweight previews for image slider, info ad, and store reference. | `erp/src/components/website/WebsiteShell.tsx`, new preview components |
| 3.8 (stale schema comment) | Updated the schema comment to list the current section keys. | `erp/prisma/schema.prisma` |

## Verification
- ERP typecheck: pass
- Website typecheck: pass
- Prisma schema validate: pass

## Operational notes
- The new migration must be applied on any environment whose database was previously built via `prisma db push` (the tables may already exist there; the migration is required for fresh `migrate deploy` builds). For an existing dev DB that already has the tables, run `prisma migrate dev` with a review of whether the migration is a no-op for existing tables or apply it against a fresh DB.
- `REVALIDATION_SECRET` and `WEBSITE_URL` must be set on the ERP and `REVALIDATION_SECRET` on the website for on-demand revalidation to work.
- The reset flow intentionally clears hero slides and ads as well as the config JSON.

## Deferred / optional
- 3.7 / 3.9: Seeding a default website config per tenant is still optional and was not added (the storefront and editor both render defaults for an empty config).
