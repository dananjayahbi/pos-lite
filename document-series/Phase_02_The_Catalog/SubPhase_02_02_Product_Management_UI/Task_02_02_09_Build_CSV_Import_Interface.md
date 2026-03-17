# Task 02.02.09 — Build CSV Import Interface

## Metadata

| Field        | Value                                                     |
| ------------ | --------------------------------------------------------- |
| Task ID      | Task_02_02_09                                             |
| Sub-Phase    | 02.02 — Product Management UI                            |
| Complexity   | High                                                      |
| Depends On   | Task_02_02_03                                             |
| Route        | /dashboard/[tenantSlug]/inventory/import                  |
| File Target  | src/app/dashboard/[tenantSlug]/inventory/import/page.tsx  |

---

## Objective

Build the CSV Import interface that allows OWNER and MANAGER roles to bulk-load products and variants into the tenant's catalog from a spreadsheet. The interface guides users through three steps: uploading the file, mapping CSV columns to VelvetPOS fields, and previewing the parsed rows before confirming the import. The result is a summary of how many records were created, warned, or skipped.

---

## Instructions

### Step 1: Create the Import Page Shell

Create src/app/dashboard/[tenantSlug]/inventory/import/page.tsx as a client component. Guard access with the product:create permission — users without it are redirected to /inventory. The page has the standard linen background and displays a pearl card centred with a max-width of 860 px. Page header: Playfair Display H1 "Import Products", a breadcrumb "Inventory → Import Products", and a link "Download CSV template" in terracotta that triggers download of a pre-built example CSV file (served from /api/download/csv-template as a static route).

A three-step progress indicator at the top mirrors the wizard progress bar from Task_02_02_03 — steps are "1 · Upload", "2 · Map Columns", and "3 · Preview & Confirm". This bar uses the same WizardProgressBar component.

### Step 2: Build the CSV Upload Zone (Step 1)

Create src/components/csv/CsvUploadZone.tsx. This component renders a large drag-and-drop area occupying the full width of the content card and standing 200 px tall. The zone has a sand dashed border (border-dashed, 2 px), a linen background, and centred content: an upload icon (Inter), the text "Drag your CSV file here, or click to browse" in Inter, and a small note "Supports .csv files up to 5 MB" in mist small.

When a file is dragged over the zone, the background transitions to a terracotta 10% tinted background and the border becomes solid terracotta. This visual cue is implemented with the HTML drag events: onDragEnter, onDragOver, and onDragLeave.

File validation is done client-side before any parsing: if the dragged or selected file is not a .csv file (check both the file extension and the MIME type text/csv), show an inline error "Only .csv files are accepted." If the file exceeds 5 MB, show "File is too large. Maximum size is 5 MB." These errors appear as red text directly below the drop zone.

On a valid file drop or selection, parse the CSV client-side using the PapaParse library with header: true and skipEmptyLines: true options. Parsing is performed inside a Web Worker via PapaParse's worker: true option to avoid blocking the main thread on large files. While parsing, show a skeleton placeholder in place of the drop zone. On completion, display a summary card below the drop zone: the filename, the row count (excluding the header row), and a chip list of the detected column headers. A "Continue to Map Columns →" primary button advances to step 2.

### Step 3: Define the CSV Format Specification

Document the expected CSV format in this task's Notes section (Step 3 here is specification documentation). Each row in the CSV represents one product variant. Multiple rows with the same Product Name are grouped into a single product with multiple variants during the import server-side processing.

Required columns (case-insensitive, spaces stripped during mapping):

| Expected Column Name | Type         | Notes                                                    |
| -------------------- | ------------ | -------------------------------------------------------- |
| Product Name         | Text         | Required on every row; rows sharing this value share one parent product |
| Category             | Text         | Must match an existing category name in the tenant's catalog; unmatched values produce a Warning status |
| Retail Price         | Decimal      | Must be positive; required                               |
| SKU or Barcode       | Text         | At least one of SKU or Barcode is required per row       |

Optional columns:

| Expected Column Name | Type         | Notes                                                    |
| -------------------- | ------------ | -------------------------------------------------------- |
| Brand                | Text         | Must match an existing brand name; unmatched produces Warning |
| Description          | Text         | Applied to the parent product; only the first row's value is used if multiple rows share the same product name |
| Gender               | Enum text    | Accepted values: Men, Women, Unisex, Kids, Toddlers (case-insensitive) |
| Tags                 | Text         | Comma-separated list of tag strings                      |
| Cost Price           | Decimal      | Positive decimal; ignored if user lacks product:view_cost_price |
| Size                 | Text         | Variant size label                                       |
| Colour               | Text         | Variant colour label                                     |
| Low Stock Threshold  | Integer      | Minimum 0; defaults to 5 if omitted                      |
| Wholesale Price      | Decimal      | Positive decimal, optional                               |

### Step 4: Build the Column Mapping Step (Step 2)

Create src/components/csv/ColumnMappingTable.tsx. This component receives the parsed CSV data (array of row objects) and the detected headers array. It displays a mapping table with one row per VelvetPOS expected field.

Each row in the mapping table has three columns:

- VelvetPOS Field: the expected field name in Inter semibold, with a "(Required)" suffix in danger red for required fields
- Detected CSV Column: a ShadCN Select dropdown populated with all detected CSV header names plus an "— Not mapped —" option. The auto-detection logic runs on mount: for each expected field, find the CSV header whose lowercase-trimmed value matches the expected field's lowercase-trimmed value. Pre-select the matching header if found; otherwise pre-select "— Not mapped —"
- Preview: shows the first three non-empty values from the auto-detected (or user-selected) column, displayed in Inter small mist italic separated by commas

Below the mapping table, a validation bar shows: [N] required fields mapped, [M] required fields not mapped (danger text if M > 0). The "Preview Import →" primary button is disabled if any required field is unmapped, with a tooltip explaining why.

### Step 5: Build the Preview and Confirm Step (Step 3)

Create src/components/csv/ImportPreviewTable.tsx. This component runs client-side row validation after the column mapping is confirmed. For each CSV row, it runs the following checks and assigns a status:

- Valid: all required fields have acceptable values, category and brand names match existing records (checked against the already-cached useCategories and useBrands data)
- Warning: the row is importable but some optional data is missing or unrecognised — for example the category name does not match any existing category (will create a new one), or a non-critical field as malformed
- Error: the row will be skipped — examples include missing required fields, non-numeric price values, or a retail price of zero

The preview table columns: Row Number, Product Name, SKU, Retail Price, Status badge, and an expand arrow that reveals the full row detail and error messages on expansion.

A summary bar above the table shows: "[X] valid", "[Y] warnings", "[Z] errors" in their respective success/warning/danger colours. A "Page: [N] / [Total]" pagination control at the bottom (25 rows per page) handles large imports without freezing the browser.

Below the summary bar, two action options: "Skip [Z] errors and import [X + Y] rows" (espresso fill) and "Go back to fix errors" (mist outline). Choosing to skip is the default happy path — the valid and warning rows proceed to import.

When "Skip errors and import" is confirmed, the component calls POST /api/products/import with the validated JSON payload (only the valid and warning rows serialised as an array of product/variant objects). While the import is running, show a ShadCN Progress bar component updating as the server streams progress (or as a simulated progress if the endpoint does not stream). On completion, show a summary toast: "[created] products created, [variants] variants added." and redirect to /dashboard/[tenantSlug]/inventory.

---

## Expected Output

Navigating to /inventory/import shows the upload zone. Dropping a well-formed CSV file parses it and shows the row count and headers. Advancing to step 2 shows the column mapping table with auto-detected matches. Advancing to step 3 shows the preview table with status badges per row. Importing valid rows creates the products and variants and redirects to the inventory list.

---

## Validation

- Files larger than 5 MB are rejected before parsing with a client-side error
- Non-CSV file types are rejected with a type error
- PapaParse parsing occurs without blocking the UI thread (Web Worker mode)
- Auto-detection pre-selects the correct column for all common header name variants
- Required fields unmapped disables the "Preview Import" button
- Row-level status correctly identifies Valid, Warning, and Error states
- Error rows show the specific error message on row expansion
- Selecting "Skip errors" posts only the passing rows to the API
- Progress indicator is visible during the API call
- Success toast accurately reports created counts and redirects to /inventory

---

## Notes

- The POST /api/products/import endpoint must validate the incoming payload server-side with Zod, even though the client already validated it — never trust client-side validation alone
- The server-side import runs in a single Prisma transaction. If the transaction fails partway through (for example a duplicate SKU constraint), the entire import rolls back and the API returns a 409 with a descriptive message
- Warning rows where the category name is unrecognised should be treated as "create a new category with that name" rather than a hard error — this is a common scenario when importing from other POS systems
- The CSV template download from /api/download/csv-template should return a minimal example CSV with two rows covering a simple product (a shirt with a Small and a Large variant) so users immediately understand the expected format
