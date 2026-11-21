# Category names are unique after normalisation

`@@unique([tenantId, name])` is exact and case-sensitive, and the API validator
neither trimmed nor normalised. A direct API caller could therefore create
"Ayurvedic Oils", "ayurvedic oils" and "  Ayurvedic Oils  " as three categories
(ARGUS #173). The UI trimmed and blocked the exact duplicate only.

## Rule

`normalizeCategoryName()` (`src/lib/categories/categoryName.core.ts`):

- trims the name,
- collapses internal whitespace runs to one space,
- lower-cases it.

`CategorySchema.name` now trims before validation, so the stored name has no
leading/trailing spaces. `createCategory` and `updateCategory` compare the
normalised new name against every category of the tenant (live **and**
soft-deleted, because archived rows keep the name reserved) and return the same
friendly 409 as before:

- live match → "A category with this name already exists"
- archived match → "... (an archived record uses this name)"

On update the category being renamed is excluded, and the check only runs when
the normalised name actually changes, so editing a description cannot trip over
a legacy case-variant row.

## Verification

`categoryName.core.test.ts` covers trim/collapse/case, case and whitespace
variants, a distinct name, self-exclusion and a blank name.
`category.validators.test.ts` pins the trimming API schema.
