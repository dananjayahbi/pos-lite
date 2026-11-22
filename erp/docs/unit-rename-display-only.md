# Unit rename is a display change only

A unit row has a stable `key` (for example `KILOGRAMS`) referenced by every raw
material and BOM line, plus a display `name` and `shortLabel`. Renaming
Kilograms to Grams used to save silently: the key stayed `KILOGRAMS` and no
conversion ran, so an existing 12 kg started reading as 12 grams (ARGUS #480).

## Behaviour

No conversion is possible without a per-unit factor and rewrite of every stored
quantity, so rename is explicitly display-only:

- `updateRawMaterialUnit` never changes `key` and never touches quantities.
- The edit dialog lists the stable key and, as soon as the name or short label
  differs, shows a warning and a required checkbox: **I understand existing
  quantities will not be converted.**
- Save is disabled until the box is ticked. Editing either field again clears
  the acknowledgement, so it always applies to the values being saved.
- Create is unaffected; there is no prior quantity to reinterpret.
- The audit row now includes the unchanged `key` alongside before/after display
  fields, so the trail shows the key was stable.

If unit conversion is ever required, it needs a conversion model (unit families
and factors) plus a controlled migration of existing material and BOM
quantities; this change deliberately does not fake it.

## Verification

`src/lib/services/__tests__/rawMaterialUnitRename.core.test.ts` covers a name
change, a short-label-only change, no change, whitespace-only edits, and the
warning text naming the stable key and the no-conversion rule.
