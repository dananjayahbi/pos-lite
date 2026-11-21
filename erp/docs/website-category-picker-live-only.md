# Website CMS category picker offers live categories only

`GET /api/store/website/categories` filtered by `tenantId` alone, so a
soft-deleted category (one with `deletedAt` set) still appeared in the section
category picker and could be saved into `section.categoryIds` (ARGUS #499 /
BUG-69).

## Behaviour

- The picker query is now
  `where: { tenantId, deletedAt: null }`, ordered by name.
- Tenant scoping and the `settings:website` permission gate are unchanged.
- Picker UI and the website config PUT are unchanged: they already consume the
  route's category list, so a deleted category can no longer be selected.

## Verification

`src/lib/website/__tests__/category-picker.test.ts` drives the real route with a
mocked Prisma client and asserts the exact `where` clause (tenant plus
`deletedAt: null`).
