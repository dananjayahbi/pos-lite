# Product CSV import (ARGUS #146)

## Problem

The importer degraded rows silently:

- a missing **Cost Price** became `0` (zero COGS / 100% margin);
- **Retail Price** below cost was accepted;
- every product was forced to `STANDARD_VAT`;
- stock was always written as `0`;
- the response only said "N products created", with no warning about any of it.

## Per-row validation

`src/lib/products/csv-import.ts` (pure, used by the API **and** the preview)
validates every row and returns `{ rowNumber, ok, data, errors, defaults }`.

| Field | Rule |
| --- | --- |
| Product Name / Category | required |
| Retail Price | required, positive |
| Cost Price | required, positive (missing is an error, never `0`) |
| Retail vs Cost | `retailPrice >= costPrice` |
| Tax Rule | `STANDARD_VAT` / `SSCL` / `EXEMPT` (case-insensitive); blank → `STANDARD_VAT` and counted |
| Initial Stock | non-negative integer; blank → `0` and counted |
| Low Stock Threshold | non-negative integer; blank → `5` |
| Wholesale Price | optional, positive when supplied |

Invalid rows are skipped and reported with their CSV row number; they are not
turned into plausible-looking products. Missing cost is counted under
`defaults.costPrice` (the decision the old importer hid) while also appearing in
`rejected` with the exact reason.

## Import summary

`POST /api/store/products/import` returns:

```json
{
  "productsCreated": 2,
  "variantsCreated": 3,
  "rowsReceived": 5,
  "rowsCreated": 3,
  "rowsImported": 3,
  "rowsRejected": 2,
  "rejected": [{ "rowNumber": 4, "reasons": ["Cost Price is required..."] }],
  "defaults": { "taxRule": 1, "initialStock": 1, "costPrice": 2 },
  "taxRuleCounts": { "STANDARD_VAT": 1, "SSCL": 0, "EXEMPT": 1 },
  "partial": true,
  "message": "2 products and 3 variants imported; 2 rows rejected; 3 defaults applied."
}
```

`partial` is true whenever any row was rejected or any default was applied, so
the UI shows a warning toast instead of a plain success. If **no** row can be
imported the route returns `400 VALIDATION_ERROR` with the rejected rows; a
success response never claims a clean import when something was skipped.

## Creation path

Valid rows are still grouped by product name (one product, many variants) and
keep the existing SKU/barcode behaviour (explicit values respected, missing
SKUs generated, missing barcodes allocated). Product-level fields (category,
brand, description, tags, tax rule) come from the group's first valid row, so a
multi-variant product uses one tax decision. Product/variant creation now goes
through `createProduct` / `createProductVariants`, so **Initial Stock** is
recorded as an `INITIAL_STOCK` movement (ARGUS #139) rather than written
directly onto `stockQuantity`. A failed group removes its just-created empty
product and is reported per row.

## Template, export and preview

- `GET /api/store/products/csv-template` now includes **Tax Rule** and
  **Initial Stock** columns with sample values.
- `GET /api/store/products/export` includes **Tax Rule** (and already exported
  stock), so exported data can round-trip.
- The column mapper has required **Cost Price**, optional **Tax Rule**, and
  **Initial Stock**; the inventory export's `Stock Quantity` header is aliased
  to Initial Stock.
- The preview uses the same validator and shows Cost, Tax Rule and Initial
  Stock; blank tax/stock appear as warnings ("will default to STANDARD_VAT",
  "will import as 0") and rows with errors cannot be imported.
