# Deleting in-use brands

Brands shared the category delete lock but the explanation told users to
"reassign or archive them first". Archiving a product does not unlink it, so the
brand stayed blocked (ARGUS #176). The shared copy fix from ARGUS #168 applies
here too; this task makes the brand surfaces use it explicitly.

## Behaviour

- The brand list row's lock uses `brandDeleteBlockedReason` in
  `lib/brands/brandDelete.core.ts`, which delegates to the single shared
  `assignedProductsReason` copy in `lib/categories/categoryDelete.core.ts`. The
  string is not duplicated.
- The brand detail panel now uses the same rule: an in-use brand keeps a
  disabled Delete button with the reason inline below it, instead of hiding the
  button. This mirrors `CategoryDetailPanel` and `ResourceDeleteButton`.
- A brand with zero products keeps the normal enabled Delete.
- The guard still counts archived products (`deletedAt: null` only): archiving
  is a visibility state, not an unlink, so the delete stays blocked until the
  products are reassigned or deleted.

## Verification

`brandDelete.core.test.ts` covers the plural, singular and zero-product cases
and asserts the wording no longer mentions archiving. The brand lock assertion
in `tests/04_categories_brands.spec.ts` uses the same wording through the shared
`ResourceDeleteButton`.
