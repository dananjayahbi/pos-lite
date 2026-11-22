# Deleting in-use records: archiving does not unlink

The delete lock for categories and brands told users to "reassign or archive
them first". Archiving a product sets `isArchived` but leaves `deletedAt` null,
and the count/guard only filters `deletedAt`, so an archived product kept the
category or brand blocked (ARGUS #168 / #176). The instruction described an
action that could not unlock deletion.

## Behaviour

- The shared blocked-lock copy now says
  `N products assigned - reassign or delete them first`.
- The copy lives once in `lib/categories/categoryDelete.core.ts`
  (`assignedProductsReason`); both the category list row, the category detail
  panel and the brand list row use it through
  `components/shared/ResourceDeleteButton`.
- Archived products are still counted by the guard on purpose: archiving is a
  visibility state, not an unlink, so the delete must stay blocked until the
  products are reassigned or deleted.
- The brand detail panel hides its Delete button while products are assigned,
  so it never shows the old or a duplicated explanation.

## Verification

`categoryDelete.core.test.ts` covers the plural, singular and zero-product copy
and asserts the text no longer mentions archiving. The brand lock assertion in
`tests/04_categories_brands.spec.ts` uses the same new wording.
