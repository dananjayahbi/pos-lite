# Unit names and short labels are unique

Only the hidden derived `key` was unique: a second "Kilograms" was accepted
with a `KILOGRAMS_2` key, and two units could both render "kg", so the material
selector and quantity suffix could not tell them apart. A name with no letters
or digits collapsed to the placeholder key "CATEGORY" (ARGUS #482).

## Rule

`src/lib/units/unitValidation.core.ts`:

- `normalizeUnitLabel()` trims, collapses whitespace and lower-cases for
  comparison (stored labels keep their casing).
- `findDuplicateUnitLabel()` rejects a name **or** short label already used by
  a live unit of the tenant, ignoring the unit being edited.
- `hasAlphanumeric()` requires at least one letter or digit in the name.

Enforcement lives on the server:

- `CreateRawMaterialUnitSchema` / `UpdateRawMaterialUnitSchema` reject a
  non-alphanumeric name with a 400.
- `createRawMaterialUnit` / `updateRawMaterialUnit` return a 409 `CONFLICT`
  (`A unit named "Kilograms" already exists.` / `That short label is already
  used by "Kilograms".`). Soft-deleted rows are ignored, so re-adding a deleted
  unit still revives the existing row.

## Verification

`unitValidation.core.test.ts` covers case/whitespace normalisation, duplicate
names and short labels, self-exclusion, distinct labels, blank inputs and the
alphanumeric rule.
