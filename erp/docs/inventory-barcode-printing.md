# Barcode printing

`/inventory/barcode-printing` — an A4 barcode-sheet workspace under **Inventory →
Barcode Printing**.

## Page layout

| Area | Contents |
| --- | --- |
| Left — *Add products* | Search by product name, SKU or barcode. Each matching variant shows the product thumbnail (or a placeholder), form, pack size, SKU and barcode; **Add** queues it. The list is paginated **10 products per page**, sorted newest-first by the server; the footer shows the visible range and previous/next page controls. |
| Left — *Selected products* | One row per queued variant with a thumbnail, copies stepper (1–99), a remove button and **Clear all**. |
| Left — *Fill the last sheet* | Repeats the queue in order until the final A4 page is full, so one variant can produce a whole sheet. |
| Right — *A4 preview* | Live portrait A4 pages (24 labels per page) showing exactly what will print, page by page — like a PDF preview. |
| Header | Total label count, page count and **Print A4**. |

Adding a variant that is already queued increments its copy count instead of
creating a duplicate row.

## Product picker loading

The picker never loads the whole catalogue. It calls
`GET /api/store/products?status=active&page=N&limit=10`; the API applies the
search filter, sorts by `createdAt DESC` (newest products first) and returns
`meta.total` / `meta.totalPages`, so the browser only receives the 10 products
for the visible page. Typing in the search box resets the page to 1. Thumbnails
use `resolveProductThumbnail()` (product thumbnail → product image → variant
thumbnail → variant image), falling back to a bag icon when no image exists.

## Sheet geometry

- A4 portrait, 210 × 297 mm, zero print margin.
- 24 labels per sheet: 3 columns × 8 rows, each 63.5 × 33.9 mm, with a 5 mm page
  pad. A dashed cut border is drawn around each label.
- Labels contain the product name, form · pack size, the Code/EAN barcode with
  its human-readable digits, the SKU and the retail price.
- The preview uses the same `BarcodeSheetPage` component as the print overlay,
  scaled by CSS transform; printing renders it at 1:1.

`src/lib/barcode-sheet.core.ts` owns the pagination maths (`paginateBarcodeSheet`)
and is unit-tested, so the preview page count and the printed page count cannot
drift apart.

## Barcode generation and storage

- `src/lib/barcode.ts` generates **EAN-13** values in the GS1 internal-use range:
  prefix `200` + nine random digits + check digit.
- `product.service.createProductVariants` allocates a tenant-unique barcode
  inside the same transaction whenever a variant is created without one, so
  "create product" can never leave a variant barcode-less. Explicit values from
  the form are respected.
- The CSV import route (`/api/store/products/import`) does the same for rows
  without a barcode, sharing one allocation set across the whole import.
- Demo data (`prisma/seed.ts`) uses deterministic EAN-13 values built from the
  variant sequence.
- Historical rows created before this rule are backfilled once:

  ```bash
  cd erp
  node --env-file=.env --import tsx scripts/backfill-barcodes.ts --dry-run
  node --env-file=.env --import tsx scripts/backfill-barcodes.ts
  ```

  The script only touches variants whose barcode is `NULL` or empty, and keeps
  values unique per tenant (soft-deleted rows still occupy the unique index).

The POS lookup endpoint (`/api/store/variants/barcode/[barcode]`) accepts the
generated 13-digit value unchanged, so printed sheets scan into the POS.

## Printing

`renderPrintOverlay` receives one `BarcodeSheetPage` per sheet plus:

```css
@page { size: A4 portrait; margin: 0; }
.barcode-sheet-page { break-after: page; }
.barcode-sheet-page:last-child { break-after: auto; }
```

The overlay root's padding is removed for this document so a 793.7 px page maps
to exactly 210 mm. Barcodes render as SVG (`react-barcode`), so they stay sharp
in print.

## Tests

- `src/lib/barcode.test.ts` — check digit, EAN-13 validity, symbology fallback.
- `src/lib/barcode-sheet.core.test.ts` — copy expansion, page overflow, fill-last-sheet.
- `tests/37_barcode_printing.spec.ts` — navigation/empty state, demo barcodes,
  queue → pages → fill, Print A4 overlay page count, product image thumbnails,
  server-side pagination (10 per page, newest first), and creating a product in
  the wizard that receives a saved, scannable barcode.
