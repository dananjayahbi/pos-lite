# Barcode label templates

The Barcode Printing sidebar page and the inventory "Print Labels" dialog used
to describe two label formats that had drifted apart: the A4 sheet printed
24 labels of 63.5 x 33.9 mm with product name, variant, SKU, barcode and price,
while the dialog printed 4 x 6 cm labels with the brand and a low-stock dot and
had no A4 preview or page count (ARGUS #157).

Both screens now read one shared definition,
`src/lib/barcode-label-templates.core.ts`, and offer the same two templates:

| Template | Size | Layout | Fields |
| --- | --- | --- | --- |
| A4 24-up | 63.5 x 33.9 mm | 3 x 8 on one A4 sheet, 24 labels | Product name, form/pack, barcode, SKU, price |
| Thermal 4 x 6 cm | 40 x 60 mm | One label per feed on a continuous roll | Brand, product name, form/pack, SKU, barcode, price, low-stock dot |

Choosing the same template on either screen therefore prints the same size,
layout, field set and page count.

## Behaviour

- Barcode Printing defaults to **A4 24-up** and previews every sheet with its
  page count. The template switch also offers the thermal roll, previewed as
  40 x 60 mm labels.
- The inventory dialog defaults to **Thermal 4 x 6 cm** (the usual case when
  printing straight from a product list) and offers the A4 24-up sheet with the
  page count and sheet preview.
- A4 printing still uses fixed explicit page breaks (`@page A4`, one sheet per
  page). Thermal printing uses `@page 40mm 60mm` with one label per page on the
  roll and the same print-overlay pipeline as every other printable document.
- `barcode-sheet.core.ts` derives its 3 x 8 grid and 24-label page size from the
  A4 template, so pagination cannot drift from the label definition again.
- `fill the last sheet` only applies to the A4 template; the thermal roll prints
  exactly the queued copies.

## Verification

`barcode-label-templates.core.test.ts` asserts the two template ids, the A4
24-up grid, the thermal 40 x 60 mm roll, the per-template field sets, the
summary text and unknown-template rejection. `barcode-sheet.core.test.ts` still
covers the pagination maths.
