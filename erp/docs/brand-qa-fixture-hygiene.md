# QA brand fixture hygiene

The live brand list contained two test artefacts: "Master Aqua" (description
"Test Brand", with a logo) and "Test BR" (description "AA"). Both had 0
products yet appeared in the brand list and could reach storefront filters
(ARGUS #179).

## Read-only detection

`src/lib/brands/brandFixtureHygiene.core.ts` identifies fixtures without
touching the database:

- exact documented names: `Master Aqua`, `Test BR` (trimmed, case-insensitive);
- the `Test …` naming convention.

`summarizeBrandFixtures(rows)` returns total/live/deleted counts plus ids, so an
operator can review the live rows.

## Cleanup policy

Nothing is deleted or rewritten automatically - this task ships no live data
mutation and no schema change. Review the flagged brands on **Brands** and, if
they are truly test data with 0 products, delete them through the normal UI
(soft delete, audited). Restore is available from the category-style recovery
path only where implemented; brands keep the standard delete confirmation.

## Verification

`brandFixtureHygiene.core.test.ts` covers the documented names, the `Test …`
convention, a real brand and the live/deleted split.
