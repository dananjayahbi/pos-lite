# M29-02 — BUG-69: website CMS category picker includes soft-deleted categories

**Severity:** P2-Major · **Module:** 29 Website CMS · **QA pin:** `tests/29_website_cms.spec.ts` L2 · **Depends on:** nothing

## Verified source state (2026-09-15) — still holds
- `src/app/api/store/website/categories/route.ts:27-31` — `prisma.category.findMany({ where: { tenantId }, … })` with **no `deletedAt: null`** filter (`Category.deletedAt` exists, `schema.prisma:727`). QA found 21 soft-deleted rows (incl. `m04x*` leftovers) in the live picker — selecting one binds a storefront section to a dead category (dead link on the public site, which correctly hides soft-deleted products/categories).
- Every other category consumer filters `deletedAt: null` (e.g. `getAllCategories`, `product.service.ts:612-614`) — this route is the outlier.

## Fix approach
1. One-line: add `deletedAt: null` to the where.
2. While here: check the sibling picker `products` route for the same omission (QA's L1 ±1 drift suggests it filters live products, but verify explicitly).
3. Add a standing note to XC-05's soft-delete policy sweep: every read path must state its deleted-row semantics.

## Files
- `src/app/api/store/website/categories/route.ts` (+ products route audit).

## Acceptance / gate
- L2 flips: picker list == live catalog categories; F12 (endpoint contract) stays green.
