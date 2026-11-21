# Supplier duplicate-name warning is surfaced on create and update

Supplier names are deliberately not unique (M06-01 / D5): a live same-name row
is a soft warning, never a 409. `createSupplier` computed `duplicateName` on the
201 response, but `SupplierSheet` only checked `success`, showed "Supplier
created" and closed. `updateSupplier` did not compute the flag at all, so
renaming onto an existing live name was silent (ARGUS #235).

## Rule

`findDuplicateSupplierName()` (`src/lib/services/supplierDuplicateName.core.ts`):

- compares normalised names: trimmed, internal whitespace collapsed and
  lower-cased, so "Lanka  Textile" matches "lanka textile";
- only considers live (`isActive: true`) suppliers;
- on update, excludes the supplier being edited, so saving unchanged details
  never warns about itself;
- an empty name never warns.

Both service paths return `{ ...supplier, duplicateName }`. Create compares the
new name against all live suppliers. Update recomputes only when the name
actually changes.

## UI

`SupplierSheet` reads `data.duplicateName` from the create/update response:

- `true` -> warning toast: "&lt;name&gt; saved - another live supplier already
  uses this name. Check for duplicates."
- `false` -> the normal success toast.

The request still succeeds (201/200) and the sheet closes; the flag is advisory.

## Verification

`src/lib/services/__tests__/supplierDuplicateName.core.test.ts` covers exact,
case/whitespace, distinct, self-exclusion, a different same-name supplier,
multiple matches and the empty name.
