# Task 02.02.10 — Build CSV Export Feature

## Metadata

| Field        | Value                                               |
| ------------ | --------------------------------------------------- |
| Task ID      | Task_02_02_10                                       |
| Sub-Phase    | 02.02 — Product Management UI                      |
| Complexity   | Low                                                 |
| Depends On   | Task_02_02_01                                       |
| File Targets | src/app/api/products/export/route.ts (API), export trigger in src/components/inventory/InventoryTable.tsx |

---

## Objective

Build the CSV Export feature that allows OWNER and MANAGER roles to download the current product catalog as a CSV file. The export respects any active filter state from the Inventory List and can optionally include cost prices based on the user's permission level. The resulting file format mirrors the import CSV format to enable a round-trip edit workflow.

---

## Instructions

### Step 1: Add the Export Button to the Inventory List

On the Inventory List page toolbar (the row containing the search bar and filter controls), add an "Export" button positioned to the right of the filter bar, to the left of the "Import CSV" button. The button uses a sand outline style with an espresso download-arrow icon prefix.

This button opens a ShadCN Popover (not a Dialog — the interaction is lightweight). The Popover is anchored to the button and appears below it.

### Step 2: Build the Export Popover Content

The Popover body contains three options presented as a vertical list of selectable items:

- "Export visible products" — exports all products matching the current active filters across all pages, not just the visible page. The count to be exported is shown in parentheses: "Export visible products ([N])". If no filters are active, this reads "Export all products ([N total])"
- "Export selected products" — only visible and clickable if at least one product row is checked in the Inventory List. Shows the count: "Export selected products ([N selected])". If no rows are selected, this option appears muted with a tooltip "Select products from the list to use this option"
- A checkbox input below the two options labelled "Include cost prices". This checkbox is only rendered for users who have the product:view_cost_price permission. CASHIER roles never see this checkbox, and the export endpoint ignores the parameter even if a CASHIER somehow sends it

A "Download" espresso button at the bottom of the Popover confirms the selection and initiates the download. The Popover closes when Download is clicked.

### Step 3: Implement the Client-Side Download Trigger

When the user clicks "Download", close the Popover and immediately show a ShadCN Sonner toast with the message "Generating export…". This toast does not auto-dismiss — it stays until the download starts.

Construct the export URL: GET /api/products/export with the following query parameters derived from current state. If exporting visible products, include the same filter params currently in the URL search params (search, categoryIds, brandIds, genders, statuses). If exporting selected products, include a productIds parameter containing the comma-separated IDs from the Zustand selection store. If "Include cost prices" is checked, include include_cost_prices=true.

Trigger the file download by creating an HTMLAnchorElement programmatically, setting its href to the constructed API URL, setting its download attribute to an empty string (the server sets the filename via Content-Disposition), appending it to the document body momentarily, calling click() on it, and then removing it from the DOM. This pattern triggers the browser's native file download without navigating away from the page.

Dismiss the "Generating export…" toast 1 500 milliseconds after the anchor click, replacing it with a brief "Download started" toast that auto-dismisses after 2 000 milliseconds.

### Step 4: Build the Export API Route

Create src/app/api/products/export/route.ts. This is a Next.js Route Handler responding to GET requests. It:

- Validates the session and checks product:view permission; returns 401 if missing
- Reads filter params from the URL: search, categoryIds, brandIds, genders, statuses, productIds, and include_cost_prices
- If include_cost_prices is truthy, additionally checks that the session has product:view_cost_price; silently ignores the flag if it does not
- Queries Prisma for all matching products with their variants, applying the same filter logic as the /api/products route but without pagination (fetches the full result set)
- Builds the CSV content as a UTF-8 string, starting with the header row and followed by one row per variant
- Sets the response Content-Type header to text/csv;charset=utf-8 and the Content-Disposition header to attachment;filename="velvetpos-inventory-YYYY-MM-DD.csv" where the date is the current date in YYYY-MM-DD format
- Streams the response body

### Step 5: Define the CSV Column Specification

The exported CSV columns match the import format exactly so the file can be re-imported after editing. Column order:

| Column               | Source                                          | Notes                                                      |
| -------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| Product Name         | product.name                                    |                                                            |
| Category             | category.name                                   | Empty string if no category                                |
| Brand                | brand.name                                      | Empty string if no brand                                   |
| Gender               | product.gender                                  | Exported as the display label: Men, Women, Unisex, etc.    |
| SKU                  | variant.sku                                     |                                                            |
| Barcode              | variant.barcode                                 | Empty string if not set                                    |
| Size                 | variant.size                                    |                                                            |
| Colour               | variant.colour                                  |                                                            |
| Cost Price           | variant.costPrice                               | Only present if include_cost_prices=true and user has permission; otherwise column is omitted entirely |
| Retail Price         | variant.retailPrice                             |                                                            |
| Wholesale Price      | variant.wholesalePrice                          | Empty string if not set                                    |
| Stock Quantity       | variant.stockQuantity                           |                                                            |
| Low Stock Threshold  | variant.lowStockThreshold                       |                                                            |
| Status               | product.status                                  | ACTIVE or ARCHIVED                                         |
| Tags                 | product.tags                                    | Exported as comma-separated string inside a quoted field   |
| Description          | product.description                             | Quoted to preserve newlines                                |
| Created At           | product.createdAt                               | ISO 8601 format                                            |

Archived variants (where variant.deletedAt is not null) are excluded from the export.

---

## Expected Output

Clicking the "Export" button on the Inventory List opens the Popover. With no active filters, "Export visible products (47)" shows the full count. Checking "Include cost prices" (if permitted) and clicking Download starts the browser download. The downloaded file contains one row per active variant with the columns in the specified order. The filename is "velvetpos-inventory-2026-03-17.csv" (current date).

---

## Validation

- Export button is visible on the Inventory List page toolbar
- Popover opens and closes correctly; clicking outside the Popover dismisses it
- "Export selected products" option is muted when no rows are selected
- "Include cost prices" checkbox is hidden from users without the permission
- Download anchor click pattern triggers the browser download without page navigation
- API route returns 401 for unauthenticated requests
- API route ignores include_cost_prices if the user lacks the permission, regardless of the query param value
- Exported CSV header row contains all expected columns (minus cost price if not included)
- Each data row corresponds to one non-deleted variant
- Tags column is correctly quoted to prevent CSV parsing issues
- Filename in the Content-Disposition header contains the correct current date

---

## Notes

- For very large tenants with thousands of products, the Prisma query should select only the required columns rather than fetching full product objects with all relations. Use Prisma select to specify exactly which fields are needed for the CSV columns to keep memory usage low
- If the total variant count exceeds 10 000, consider adding a server-side cap and a warning in the export summary, but do not implement streaming pagination in this task — keep it simple
- The Tags field must be serialised as a quoted comma-separated string within a CSV-quoted field to avoid breaking CSV parsers. If a tag itself contains a comma, it should be wrapped in double quotes according to RFC 4180
