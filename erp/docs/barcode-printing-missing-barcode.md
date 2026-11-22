# Barcode printing - a missing barcode is not a SKU barcode

ARGUS #163: when a variant had no saved barcode, both the picker and the label
silently substituted the SKU and printed it as a Code 128 symbol. The label
looked like a real barcode but encoded the wrong value.

## Behaviour

- `hasPrintableBarcode()` is the single rule (non-blank string).
- The picker row says **"no barcode saved - set one in Inventory"**, and its
  Add button is disabled with an explanatory `aria-label`/title. A guard in the
  click handler reports the product and SKU in the copy notice.
- The queue type only accepts variants with a printable barcode.
- `BarcodeLabel` no longer falls back to the SKU. If a label ever receives an
  empty barcode it renders **"SKU only - no barcode"** instead of a fake
  symbol.
- Variant search treats a missing barcode as empty rather than crashing.

The inventory label dialog is unchanged; this fix is scoped to Barcode
Printing.

## Verification

- `npx tsc --noEmit`
- `npx vitest run src/lib/barcode-printing.core.test.ts src/lib/barcode-printing-search.core.test.ts`
