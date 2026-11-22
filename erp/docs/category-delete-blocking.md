# Deleting in-use categories

The category list row already blocked deletion of a category with products, but
the detail panel's **Delete** button stayed enabled and opened a confirmation
dialog that could only fail at the API (ARGUS #165).

## Behaviour

- The detail panel derives the same blocked state as the list row from
  `_count.products` (the freshly loaded detail count, falling back to the list
  row while it loads).
- An in-use category's Delete button is disabled, carries the accessible label
  and tooltip `Cannot delete <name>: N products assigned - reassign or delete
  them first`, and shows that reason inline under the button.
- A category with zero products keeps the normal enabled Delete.

The copy lives in `lib/categories/categoryDelete.core.ts` and is used by both
`CategoryDetailPanel` and the shared `ResourceDeleteButton`, so the list and
detail cannot drift apart again.

## Verification

`categoryDelete.core.test.ts` covers the plural, singular and zero-product
cases.
