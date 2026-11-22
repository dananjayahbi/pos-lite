# BOM activation lifecycle

ARGUS #251.

The BOM table rendered Active/Inactive badges and hid Produce for inactive
recipes, but nothing in the UI could change `isActive`. The only way to retire
a recipe was Delete.

- Each row now has a **Deactivate** / **Activate** action (requires `bom:edit`),
  separate from Delete. It calls the existing `PATCH /api/store/boms/[id]` with
  `{ isActive }` and refreshes the list.
- `updateBom` no longer treats an `isActive`-only change as a recipe edit. A BOM
  with production runs can be retired because its ingredient rows and history
  stay intact; changes to `name`, `notes` or `ingredients` remain refused with
  `BOM_LOCKED`.
- The audit row (`BOM_UPDATED`) now records the new `isActive` value.

Deactivated recipes keep their production history, cannot be produced, and stay
visible in the list with the Inactive badge.
