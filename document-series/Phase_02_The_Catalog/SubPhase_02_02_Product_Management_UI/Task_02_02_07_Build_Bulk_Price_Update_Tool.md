# Task 02.02.07 — Build Bulk Price Update Tool

## Metadata

| Field        | Value                                                    |
| ------------ | -------------------------------------------------------- |
| Task ID      | Task_02_02_07                                            |
| Sub-Phase    | 02.02 — Product Management UI                           |
| Complexity   | Medium                                                   |
| Depends On   | Task_02_02_05                                            |
| File Targets | src/components/inventory/BulkActionBar.tsx, src/components/inventory/BulkPriceUpdateDialog.tsx |

---

## Objective

Build the Bulk Price Update tool that lets OWNER and MANAGER roles apply a uniform price change to all variants belonging to a selection of products from the Inventory List. The tool appears as a contextual floating action bar once any product rows are selected and is accessible only to users with the product:edit permission.

---

## Instructions

### Step 1: Build the BulkActionBar Component

Create src/components/inventory/BulkActionBar.tsx. This component reads the selectedProductIds set from the inventorySelectionStore Zustand store. When the set is empty, the component renders null. When one or more IDs are present, the component renders a sticky bar fixed to the bottom of the viewport, sitting above the pagination row with a 12 px gap.

The bar has an espresso background with sand-coloured left and right borders, a subtle upward drop shadow, and a full viewport width. Its content is a max-width 1200 px centred row containing:

- A count label on the left: "[N] product[s] selected" in Inter medium pearl text; uses correct pluralisation ("1 product selected" vs "3 products selected")
- Three action buttons in the centre-right: "Bulk Price Update" (espresso outline with pearl text), "Export Selected" (sand outline with espresso text), and "Clear Selection" (danger-coloured ghost text button)

The "Export Selected" button calls the CSV export endpoint immediately with the selected IDs as a query parameter — it does not open a dialog. The "Clear Selection" button calls clearSelection from the store. The "Bulk Price Update" button sets a local isDialogOpen state to true, causing the BulkPriceUpdateDialog to mount.

Guard "Bulk Price Update" visibility with the product:edit permission — hide the button but keep "Export Selected" and "Clear Selection" if the user is a CASHIER somehow with selected rows.

### Step 2: Build the BulkPriceUpdateDialog Component

Create src/components/inventory/BulkPriceUpdateDialog.tsx. This is a ShadCN Dialog (centred modal, not a Sheet) with a minimum width of 520 px. The Dialog header shows "Bulk Price Update" in Playfair Display semibold and a subtitle: "Updating [N] selected products".

### Step 3: Build the Mode Toggle

At the top of the Dialog body, render a mode toggle implemented as two tab-style buttons: "Set Fixed Price" and "Apply % Change". The toggle uses a sand-bordered tab bar with espresso fill on the active selection and mist fill on the inactive one. Switching modes shows or hides the relevant form fields below. The active mode is tracked in a local useState string.

### Step 4: Build the Set Fixed Price Mode

When "Set Fixed Price" is active, show two numeric inputs: "New Cost Price" (Rs. prefix, right-aligned) and "New Retail Price" (Rs. prefix, right-aligned). Both inputs validate that the entered value is positive. A warning banner below the inputs uses a sand background with espresso text and a warning icon and reads: "This price will apply to ALL variants of the [N] selected products. Individual variant prices can still be adjusted after." The banner is always visible in this mode as a persistent reminder.

### Step 5: Build the Apply % Change Mode

When "Apply % Change" is active, show three controls:

- A percentage value input labelled "Percentage" with a "%" suffix indicator. Validation: must be between 1 and 200 (whole numbers only).
- A direction selector rendered as two chip-style toggle buttons: "Increase" and "Decrease". The active selection is espresso fill; inactive is mist outline.
- A target selector rendered as three chip-style toggle buttons: "Cost Price", "Retail Price", "Both". The active selection uses espresso fill.

Below these controls, a preview table shows the effect of the current settings on the first five variants across the selected products. The preview table has three columns: Variant SKU (JetBrains Mono), Before (current price in Rs. format), and After (projected price in Rs. format, coloured success green or warning orange depending on direction). A grey italic note below the table reads "Showing first 5 variants of [total] total variants affected." The preview updates reactively as the user changes the percentage or target inputs via React Hook Form's watch.

### Step 6: Build the Confirm Button and API Call

The Dialog footer contains: "Cancel" (mist outline) and "Apply to All [N] Products" (espresso fill). The number in the button label reflects the product count from the Zustand selection store. Clicking Cancel calls onClose without any API call.

Clicking confirm triggers React Hook Form's handleSubmit on the dialog's form. The Zod validation schema (src/schemas/bulkPriceSchema.ts) enforces: percentage between 1 and 200 in percentage mode, positive prices in fixed mode, and valid direction/target enum values. Invalid inputs display inline error messages.

On valid submission, the form calls the useBulkPriceUpdate mutation hook which POSTs to /api/products/bulk-price-update with the payload: productIds (string array), mode (FIXED or PERCENT), value (number), direction (INCREASE or DECREASE, only for PERCENT mode), and target (COST, RETAIL, or BOTH). The endpoint applies the changes using a Prisma transaction and returns { updated: number, errors: number }.

On success: close the Dialog, call clearSelection, and show a Sonner toast: "Price update complete — [updated] variants updated across [N] products." If errors is greater than zero, append " ([errors] variants had errors and were skipped.)" to the toast.

On API error: keep the Dialog open and show an error toast with the server's error message.

### Step 7: Create the API Route Scaffold Note

The POST /api/products/bulk-price-update route must be created as part of this task. Document that this route:
- Requires a valid tenant session and product:edit permission
- Accepts and validates the payload with Zod server-side before touching the database
- Wraps all variant updates in a single Prisma transaction so a partial failure rolls back entirely
- Creates an AuditLog entry per updated product (not per variant) to avoid log table bloat
- Caps input: percentage mode rejects values above 200 or below 1; fixed mode rejects zero or negative prices; productIds array must not exceed 500 items

---

## Expected Output

Selecting three products on the Inventory List shows the floating action bar with the product count. Clicking "Bulk Price Update" opens the dialog. Switching to "Apply % Change" mode and entering 10 with Increase on Retail Price shows the preview table updating in real time. Confirming applies the change and shows the success toast. The selection is cleared after success.

---

## Validation

- BulkActionBar is invisible when no rows are selected and visible when any are selected
- Button labels pluralise correctly for singular and plural product counts
- "Clear Selection" empties the selection store and hides the BulkActionBar
- Dialog mode toggle switches between Fixed and Percentage form views
- Warning banner is always visible in Fixed Price mode
- Percentage preview table updates as inputs change
- Zod schema rejects percentage above 200, negative prices, and empty productIds
- API call includes only dirty fields and uses a transaction
- Success toast shows updated count and errors count (if any)
- Dialog remains open on API error with the error message displayed

---

## Notes

- The preview data for the % change mode should be fetched client-side from the useProducts hook that already has data in cache — do not make an additional API call just for preview calculations. Derive the projected prices from the already-cached product/variant data
- The AuditLog entry for bulk price update should include the full before/after pricing snapshot as JSON in the metadata field so the change is fully auditable
- This operation is irreversible from the UI — there is no "undo" button. The warning banner in Fixed Price mode exists for this reason. Ensure the API route enforces the permission check rigorously
