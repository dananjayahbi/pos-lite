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

## Product vs variant range

The picker paginates by product (10 per page) but every row and every label is a
variant. The range therefore states both facts, for example
`Products 1-10 of 12 · 17 of 23 variants`, and the pagination reads
`Products page 1 of 2`. The variant total comes from the products API
(`meta.variantTotal`), counted with the same product filter as the page, so it
includes multi-variant products without loading them all into the browser
(ARGUS #158). Headings now say "Add variants" / "Selected variants".

## Variant-level search

The API searches at product level, so an exact barcode used to return the
matching product with every sibling pack (same product name, different barcodes
and prices). A scan-and-reprint could then print the wrong label. The picker now
filters the fetched rows through `barcode-printing-search.core.ts`:

- an exact barcode or SKU match is shown alone;
- a partial SKU/barcode match keeps only the matching variants;
- a product-name match still shows all of that product's variants;
- the range switches to "N matching variants" while a search is active
  (ARGUS #159).

## Tax-inclusive shelf price

Retail prices are stored pre-tax and the till adds VAT/SSCL, so a label showing
the bare catalogue figure understated the amount payable (ARGUS #160). Both
templates now print the tax-inclusive amount plus a qualifier:

- `STANDARD_VAT` -> catalogue price + tenant VAT, qualified **incl. VAT**;
- `SSCL` -> catalogue price + tenant SSCL, qualified **incl. SSCL**;
- `EXEMPT` -> catalogue price, qualified **VAT exempt**;
- a standard product with no configured rate keeps the catalogue price and is
  explicitly qualified **excl. VAT**.

The product's `taxRule` flows into `LabelVariant` (bulk-variants API and the
product detail tab) and is priced by `pricing/label-price.core.ts` with the
tenant rates from `/api/settings/taxes`, so the A4 sheet, the thermal label and
the previews agree.

## Dialog previews

The Print Labels dialog no longer previews only the first queued variant. It
shows a chip per variant so any pack can be inspected, lists every variant's SKU,
form/pack and tax-inclusive price under **Label contents**, and the A4 mode has
page navigation plus the total page count (`Page 2 of 3`). The thermal preview
switches to the selected variant (ARGUS #161).

## Verification

`barcode-label-templates.core.test.ts` asserts the two template ids, the A4
24-up grid, the thermal 40 x 60 mm roll, the per-template field sets, the
summary text and unknown-template rejection. `barcode-sheet.core.test.ts` still
covers the pagination maths, `barcode-printing.core.test.ts` covers the
product/variant range labels, and `barcode-printing-search.core.test.ts` covers
exact/partial search narrowing.
