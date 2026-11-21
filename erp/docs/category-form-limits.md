# Category form limits

The category dialog accepted 520 description characters while the API rejects
anything over 500, and the sort-order input had no upper bound although the
column is a 32-bit integer (ARGUS #170). Both failures surfaced late as server
validation errors.

## Behaviour

- The description textarea is capped at `CATEGORY_DESCRIPTION_MAX` (500) and
  shows a live `n/500` counter. `validateCategoryForm()` also rejects an
  over-limit value, so Save stays disabled if the cap is bypassed.
- Sort order accepts whole numbers from 0 to `CATEGORY_SORT_ORDER_MAX`
  (2,147,483,647) in the input and in `CategorySchema`; Save is disabled and an
  inline error explains the range when it is out of bounds.
- The constants live in `src/lib/categories/categoryForm.core.ts`, so the UI
  and the API validator cannot drift apart.

## Verification

`categoryForm.core.test.ts` covers the 500-character boundary and the 32-bit
sort-order maximum; `category.validators.test.ts` covers the same bounds on the
API schema.
