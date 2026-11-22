# Raw-material category and unit labels

ARGUS #247.

The live edit form rendered "Powders & Herbs" twice and "Kilograms (kg)" twice:

1. the current-value fallback was prepended beside the fetched options, and
2. category/unit services only de-duplicated the derived **key**, so a tenant
   could create a second display name with a `_2` key.

The Adjust dialog also read "Current quantity: 1 Kilograms."

- `findDuplicateRawMaterialCategoryName` (case/whitespace-insensitive) now
  guards both category create and rename; a duplicate returns
  `409 A category named "…" already exists.` Units already had this guard
  (`findDuplicateUnitLabel`, ARGUS #482).
- `dedupeLabeledOptions` renders one option per display label and prefers the
  key the form is bound to, so legacy duplicate rows cannot produce an
  ambiguous selector.
- The Adjust dialog shows the compact unit suffix (`1 kg`) instead of the
  plural display name.

Stored keys and quantities are untouched; this is a label/validation fix. The
pure helpers are unit tested.
