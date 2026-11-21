# Unit form edge cases: clearing the short label and derived labels

Clearing **Short label** while editing sent no `shortLabel`, so the API kept the
old label and the UI still said "Unit updated" (ARGUS #486). When a create
omitted the short label, the server derived one with
`humanizeUnitKey(key).slice(0, 12)`, cutting mid-word: "Bottles Of 500ml"
became "Bottles Of 5".

## Clear semantics

- `UpdateRawMaterialUnitSchema.shortLabel` accepts `string | null`. `null` is
  an explicit "clear and derive" instruction.
- The Units dialog always sends the field in edit mode: `shortLabel || null`.
  The service then derives `deriveUnitShortLabel(newName ?? existing.name)`, so
  the toast is truthful and the label is never silently stale.
- An empty string is still rejected (400); leave the field blank to derive.

## Complete derived labels

`deriveUnitShortLabel()` (in `src/lib/units/unitValidation.core.ts`):

- trims and collapses whitespace;
- keeps whole words up to the 20-character cap
  ("Bottles Of 500ml Assorted" → "Bottles Of 500ml");
- hard-cuts only a single word longer than the cap;
- falls back to `unit` for a blank name.

The same helper drives the dialog hint ("Leave blank to derive a label from the
name (Bottles Of 500ml)") and the rename-confirmation comparison, so clearing a
label that derives back to the current text does not ask for a pointless
acknowledgement.

## Verification

`unitValidation.core.test.ts` covers the derivation; 
`rawMaterialUnit.validators.test.ts` covers `null`, empty string and the 20-char
cap. `tsc --noEmit` passes.
