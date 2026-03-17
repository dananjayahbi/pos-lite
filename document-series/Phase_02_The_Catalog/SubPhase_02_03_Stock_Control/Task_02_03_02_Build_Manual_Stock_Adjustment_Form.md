# Task 02.03.02 — Build Manual Stock Adjustment Form

## Metadata

| Field | Value |
|---|---|
| Task ID | 02.03.02 |
| Task Name | Build Manual Stock Adjustment Form |
| Parent Sub-Phase | SubPhase_02_03 — Advanced Stock Control |
| Complexity | Medium |
| Dependencies | Task_02_03_01 complete |
| Output Path | src/app/dashboard/[tenantSlug]/stock-control/adjust/page.tsx |

---

## Objective

Build the Manual Stock Adjustment form page at /dashboard/[tenantSlug]/stock-control/adjust. This page allows authorised staff to select a product and variant, choose an adjustment direction and quantity, assign a reason from the StockMovementReason enum, and submit the change. Every successful submission creates an immutable StockMovement record and updates the variant's stockQuantity atomically. The form must guide users clearly through each step and surface live feedback on the resulting stock level before they commit.

---

## Instructions

### Step 1: Create the Route and Page Shell

Create the directory src/app/dashboard/[tenantSlug]/stock-control/adjust/ and a page.tsx file within it. Apply the stock:adjust permission guard at the top of the page — if the authenticated user does not hold this permission, render a permission-denied card with the message "You do not have permission to adjust stock. Contact your store manager." and a back link to /stock-control. Do not redirect; render inline.

The page uses the linen background. The content is a single centered card of maximum width 2xl (approximately 42 rem). The card uses the pearl background with a sand border and standard rounded corners. Place the card in the vertical and horizontal centre of the content area on desktop, and full-width on mobile.

### Step 2: Add the Page Header

Inside the card, render an H2 heading in Playfair Display: "Manual Stock Adjustment". Below the heading, render a short Inter subtitle in muted espresso text: "Select a variant, specify the quantity change, and record the reason."

Include a breadcrumb trail at the very top of the page (above the card) showing: Dashboard → Stock Control → Manual Adjustment. Each crumb is a clickable link except the last.

### Step 3: Build the Product Lookup Combobox

The first form field is a product search combobox implemented using the ShadCN Command component rendered inside a Popover. The label is "Product" with an asterisk indicating it is required.

The combobox input is debounced 300 milliseconds. As the user types, a query is sent to GET /api/products?search={term}&tenantSlug={slug}&activeOnly=true. The dropdown shows matching product names with their category as secondary text. The selected product name is shown in the trigger button once chosen. If no results are found, show "No products found — try a different name" inside the dropdown.

When the user selects a product, store the productId in the React Hook Form state and trigger the variant query for that product.

### Step 4: Build the Variant Select Dropdown

The second form field is a ShadCN Select dropdown that appears and becomes interactive only after a product has been selected. Its label is "Variant" with an asterisk.

The options are loaded from GET /api/products/[productId]/variants?activeOnly=true. Each option is formatted as "[SKU] — [Size] / [Colour] (Stock: X)" where X is the current stockQuantity. SKU values within the option label use the JetBrains Mono font class. Render a loading skeleton inside the select while the variant list is being fetched. Variants with stockQuantity of zero should be included in the list (they may need stock added) but displayed with an "Out of stock" label in danger-coloured text beside their entry.

Once a variant is selected, display a prominent pill badge directly below the Select component showing the current stock level. The pill is success-coloured if stock is comfortably above threshold, warning-coloured if stock is at or near the threshold (within 20% above), and danger-coloured if stock is zero.

### Step 5: Build the Adjustment Type Toggle

The third form field is a pair of large toggle buttons side by side, acting as a mutually exclusive selection group. The label for the group is "Adjustment Type".

The "Add Stock" button is success-coloured (using the success semantic token #2D6A4F) with a plus icon. The "Remove Stock" button is danger-coloured (#9B2226) with a minus icon. The selected button has a filled background; the unselected button appears as an outline. Selecting one deselects the other. Default state is neither selected — the user must explicitly choose.

When "Add Stock" is selected, the quantity field label below becomes "Quantity to Add". When "Remove Stock" is selected, the label becomes "Quantity to Remove". The adjustment type selection controls the sign of the quantityDelta sent to the API: positive for add, negative for remove.

### Step 6: Build the Quantity Field with Live Preview

The fourth form field is a positive integer input with the label "Quantity to Add" or "Quantity to Remove" depending on the toggle state. The field only accepts whole positive numbers. A minimum value of 1 is enforced. Large quantity values (above 999) show a warning note: "Please verify this quantity before submitting."

Directly below the quantity input, render a live preview line: "Stock after adjustment: X units." Compute X in real time from the selected variant's current stockQuantity and the entered quantity with the chosen direction. Colour the preview text based on the projected outcome:

- If the resulting quantity exceeds the lowStockThreshold comfortably, use success green text.
- If the resulting quantity is at or below lowStockThreshold but above zero, use warning text with a "⚠ This will trigger a low stock alert" note appended.
- If the resulting quantity would be zero, use danger text with "⚠ This will mark the variant as out of stock" appended.
- If the resulting quantity would be negative (only possible in remove mode), display a validation error inline: "Cannot remove more stock than currently available." The submit button must be disabled in this state.

### Step 7: Build the Reason Select

The fifth form field is a ShadCN Select dropdown with the label "Reason" (required). The options map the StockMovementReason enum values to human-readable labels:

| Enum Value | Display Label |
|---|---|
| FOUND | Found |
| DAMAGED | Damaged |
| STOLEN | Stolen or Lost |
| DATA_ERROR | Data Entry Correction |
| RETURNED_TO_SUPPLIER | Returned to Supplier |
| INITIAL_STOCK | Initial Stock Entry |
| SALE_RETURN | Customer Return |
| PURCHASE_RECEIVED | Received from Purchase |
| STOCK_TAKE_ADJUSTMENT | Stock Take Adjustment |

Note that STOCK_TAKE_ADJUSTMENT should appear in the list for completeness but should not normally be selected manually — add a parenthetical note "(used by stock takes)" in the option label to guide users.

### Step 8: Build the Note Textarea

The sixth form field is an optional textarea with the label "Note (optional)". The placeholder text reads: "Add context for this adjustment e.g. 'Found 3 items in the back store room'." The maximum character count is 500. Display a live remaining character counter below the textarea in muted text: "X / 500 characters". This counter updates on every keystroke.

### Step 9: Implement Form Validation with Zod

Define a Zod schema to validate the entire form client-side before submission. The schema must enforce: productId is a non-empty string, variantId is a non-empty string, adjustmentType is either "add" or "remove", quantity is a positive integer of at minimum 1, reason is one of the valid StockMovementReason enum string values, and note is an optional string with a maximum length of 500 characters.

Additionally, validate that the computed resulting quantity is not negative. This cross-field validation must be added as a Zod refine rule on the schema root, checking that if adjustmentType is "remove" then quantity must not exceed the selected variant's current stockQuantity. The current stock value must be available in the form state to perform this check.

Wire the schema to React Hook Form using the zodResolver. Display inline error messages below each field when validation fails on submit or on blur.

### Step 10: Build the Submit Handler and API Call

The submit button is labelled "Apply Adjustment" and uses the espresso primary button style. It is disabled while the form is invalid or while a submission is in progress. During submission, render a spinner inside the button and change the label to "Applying…".

On submit, call POST /api/stock/adjust with the body containing variantId, quantityDelta (signed integer: positive for add, negative for remove, computed from adjustmentType and quantity), reason, and note (omit if empty). Handle success and error responses:

On success: display a ShadCN Sonner toast with the message "Stock updated from X to Y units." where X is the quantityBefore and Y is the quantityAfter values returned in the response. Then reset the form to its default empty state. Render two action options below the reset form: a primary button "Adjust Another Variant" that clears all state and re-focuses the product combobox, and a secondary link "View Movement History" that navigates to /stock-control/movements.

On error: display a Sonner toast with the error message from the API response. If the error code indicates a below-zero validation failure (which should have been caught client-side but may arrive from the server as a safety net), highlight the quantity field with a red border and the server error message beneath it.

### Step 11: Display Loading and Transition States

While the product combobox is searching, show a loading spinner inside the dropdown. While the variant list is being fetched after product selection, show a skeleton row inside the variant Select. During form submission, disable all form fields to prevent double-submission. After a successful submission, the confirmation state (with the "Adjust Another Variant" prompt) should persist for at least 3 seconds before automatically resetting, to give the user time to read the confirmation.

---

## Expected Output

A fully functional Manual Stock Adjustment form at /dashboard/[tenantSlug]/stock-control/adjust. The form performs product and variant lookup, shows real-time stock level previews, validates all inputs client-side, submits to the adjustment API, and displays a clear success or error toast. The resulting database state after a successful submission shows the updated stockQuantity on ProductVariant and a new StockMovement record in the append-only log.

---

## Validation

- Open the adjustment form as a MANAGER user. Search for "Ocean Blue Midi Dress" in the product combobox and confirm matching results appear.
- Select a variant with a known stock level. Enter an add quantity of 5. Confirm the live preview shows the correct new stock level.
- Attempt to remove more stock than available. Confirm the form shows an inline error and the submit button is disabled.
- Submit a valid add-stock adjustment. Confirm the success toast appears with the correct before/after values. Browse to the stock movement history page and confirm the new movement record appears at the top with the correct reason badge.
- Attempt to access the page as a STOCK_CLERK without stock:adjust permission. Confirm the permission-denied card renders rather than the form.

---

## Notes

- The debounce delay on the product search combobox must be exactly 300 milliseconds. Shorter delays risk excessive API calls on fast typists; longer delays feel sluggish.
- Never allow the form to compute a negative quantityDelta silently. Both client-side Zod validation and server-side validation in the API route handler must reject below-zero adjustments independently.
- The "Adjustment Type" toggle is intentionally prominent and requires explicit selection to reduce the risk of accidentally removing stock when the intent was to add. Do not default to either direction.
- StockMovement records are permanently immutable once created. If a user makes an error, they must submit another adjustment to correct it. Make this clear in a helper text note near the submit button: "Adjustments are permanent. Use a follow-up adjustment to correct mistakes."
