# Creating a complete category in one step

The inline **New Category** form only rendered a name input, so description,
image and sort order required a create-then-edit round trip (ARGUS #169).

## Behaviour

- **New Category** opens `CategoryEditDialog` in create mode, the same dialog
  used for edits (`category={null}`).
- Create and edit render the identical field set: name, category image,
  sort order and description.
- The Save payload is built by `validateCategoryForm()`
  (`src/lib/categories/categoryForm.core.ts`) for both modes, so a create
  cannot silently drop a field that edit accepts.
- The old `InlineCategoryForm` component is removed; there is one category
  form, not two with different fields.

## Verification

`categoryForm.core.test.ts` pins the complete create payload (name,
description, sort order, image), blank-to-null clearing and the name bounds.
