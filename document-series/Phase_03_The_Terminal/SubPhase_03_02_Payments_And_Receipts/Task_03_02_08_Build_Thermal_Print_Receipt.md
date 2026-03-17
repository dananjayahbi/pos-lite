# Task 03.02.08 — Build Thermal Print Receipt

## Metadata

| Field        | Value                                        |
|--------------|----------------------------------------------|
| Sub-Phase    | 03.02 — Payments, Receipts and Offline Mode  |
| Phase        | 03 — The Terminal                            |
| Complexity   | Medium                                       |
| Dependencies | Task 03.02.06 (Sale API Routes complete)     |

---

## Objective

Create the `buildThermalReceiptHtml` function in `src/lib/receipt-renderer.ts` that produces a self-contained HTML document formatted for 80 mm thermal paper, and wire it into the `GET /api/sales/[id]/receipt` route so that opening the URL in a browser tab displays the receipt and triggers the browser's print dialog.

---

## Instructions

### Step 1: Create the Receipt Renderer Module

Create the file `src/lib/receipt-renderer.ts`. This module has one exported function, `buildThermalReceiptHtml`, and any private helper functions that support it. It has no runtime dependencies other than the TypeScript types for the `Sale`, `SaleLine`, `Payment`, and `Tenant` models from Prisma Client, plus the project's currency formatting utility. The module must never import anything from Next.js or any browser API — it must be a pure string-building function compatible with server-side rendering in an API route.

At the top of the file, add a comment explaining that the function returns a complete HTML document string intended to be served with `Content-Type: text/html`. The browser opens this page in a new tab and the embedded script triggers `window.print()` automatically. On a configured thermal printer that intercepts browser print jobs, this produces a receipt without any additional software.

### Step 2: Define the Function Signature

Define the exported function `buildThermalReceiptHtml`. It accepts three positional parameters: `sale` (a fully hydrated sale object including its `SaleLine` records and `Payment` records), `tenant` (the Tenant database record providing store name, address, phone number, and a custom thank-you message), and `cashierName` (a plain string representing the full name of the cashier who processed the sale). The function returns a single string containing the entire HTML document.

Define a private helper function `formatMoney` that accepts a Decimal or number value and returns a string in the format `Rs. X,XXX.XX` with comma-separated thousands grouping. This helper is used throughout the receipt for all monetary display values rather than repeating formatting logic.

Define a private helper function `truncateProductName` that accepts a string and a maximum character count (defaulting to 24 characters for the 80 mm paper width in a monospace font at standard receipt font size). If the string exceeds the maximum, return the first `max - 1` characters followed by a single ellipsis character. This keeps line-item rows from overflowing to a second line on narrow paper.

### Step 3: HTML Document Structure

The returned HTML document must be a complete and valid HTML5 document. Begin with the `<!DOCTYPE html>` declaration, then an `<html lang="en">` element. The `<head>` section contains: a `<meta charset="UTF-8">` tag, a `<meta name="viewport">` tag with `width=device-width, initial-scale=1.0`, a `<title>` element whose text is the string "Receipt — " concatenated with the short sale reference (first 8 characters of the sale id in uppercase), and a single `<style>` block containing all CSS (described in detail in Step 4). No external CSS links, no Web Font API requests that would stall printing, and no JavaScript libraries are referenced — the document must render and print correctly even without internet connectivity at print time.

The `<body>` contains a single `<div id="receipt">` which holds all receipt content. After the receipt div, a `<script>` element triggers `window.print()` on a 200 ms timeout using `setTimeout` to ensure the page has fully rendered before the print dialog opens.

Immediately after the body closing tag, include a second `<div id="no-print-wrapper">` containing a `<p>` tag with the text "If printing has not started automatically, use your browser's Print option." This message is visible on screen but hidden when printing via the `@media print` rule defined in the CSS.

### Step 4: CSS Styling for Thermal Layout

Write the CSS inside the `<style>` tag with the following structure.

The universal reset: set `box-sizing: border-box` on all elements. Set `body` font to a monospace font stack — `'Courier New', Courier, monospace` — and set `font-size: 9pt` (a common thermal receipt readable size). Remove all margin and padding from `body`. Set `background: white` and `color: black` to avoid any theme-related colour injection.

The `@page` rule: set `size: 80mm auto` (auto height lets the page extend to the full receipt length), set all four margins to `3mm`. This rule is what tells the browser print dialog to target 80 mm paper. When the receipt is printed to an 80 mm thermal printer, the physical output matches the digital preview.

The `@media print` rule: hide any element that is not the receipt itself. Specifically, add a rule that sets `display: none !important` on `#no-print-wrapper` and on any ancestor elements that the browser might add. Also add a rule ensuring `#receipt` remains visible with `display: block !important`.

The `#receipt` container: set `width: 74mm` (leaving 3 mm margin per side), `margin: 0 auto`, and `padding: 0`.

Utility classes used throughout the receipt HTML:
- `.center` — `text-align: center`
- `.right` — `text-align: right`
- `.bold` — `font-weight: bold`
- `.large` — `font-size: 12pt` (for the grand total)
- `.small` — `font-size: 8pt` (for footer text)
- `.separator` — a horizontal rule styled as `border: none; border-top: 1px dashed #000; margin: 3px 0`
- `.separator-solid` — same but using `solid` style for the top and bottom of the line-items block
- `.row` — `display: flex; justify-content: space-between; width: 100%`
- `.row .name` — `flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; padding-right: 4px`
- `.row .amount` — `white-space: nowrap; text-align: right`

### Step 5: Receipt Header Section

The first element inside `#receipt` is the store header block. Centre all elements in this section.

Render the `tenant.name` in a `<p>` tag with the `.center .bold` classes and a slightly larger font size (`font-size: 11pt`). This is the store name, and it appears at the very top in bold so the cashier and customer can immediately identify the receipt source.

Below the name, render `tenant.address` in a `<p class="center small">` tag. If the address is null or undefined, omit this element entirely — do not render an empty `<p>` tag.

Below the address, render `tenant.phoneNumber` prefixed with the text "Tel: " in another `<p class="center small">` tag. Apply the same null-guard.

After the header block, insert a `.separator-solid` `<hr>` element.

### Step 6: Sale Reference and Cashier Block

Below the solid separator, render the sale metadata section. Each line is a key-value row using the `.row` class.

Row one: the label "Receipt No." on the left and the first 8 characters of `sale.id` in uppercase on the right. Use the `.bold` class on the right element to distinguish the reference number visually.

Row two: the label "Cashier" on the left and `cashierName` on the right.

Row three: the label "Date" on the left and the date portion of `sale.createdAt` formatted as `DD/MM/YYYY` (e.g. "17/03/2026") on the right.

Row four: the label "Time" on the left and the time portion of `sale.createdAt` formatted as `HH:MM` in 24-hour format on the right.

After the four rows, insert another `.separator` `<hr>`.

### Step 7: Line Items Table

Below the metadata separator, render the line items section. Each `SaleLine` in `sale.saleLine` (or `sale.saleLines` depending on the Prisma relation name — use whichever is correct in the schema) generates a small group of rows.

For each line item: first render a single row with the `truncateProductName` result of `line.productNameSnapshot` on the left and nothing on the right (this is the product name row, occupying the full width). Optionally, if `line.variantDescriptionSnapshot` is non-empty, render a second row directly below with the variant text in a `.small` muted style (using `color: #666`).

Then render the quantity-price-total row as a `.row` with three parts: the quantity left-aligned (e.g. "3x"), the unit price centre-aligned (e.g. "Rs. 250.00"), and the line total right-aligned (e.g. "Rs. 750.00"). All three parts share the row's flex container.

If the line has a `discountPercent` greater than zero, render a fourth sub-row immediately below in `.small` italic text, right-aligned: "Discount: -Rs. [computed discount amount]".

Insert a blank line (a `<div style="height:2px">`) between each line item group. Do not insert a separator between items — the spacing is sufficient.

After all line items, insert a `.separator-solid` `<hr>`.

### Step 8: Totals Section

Below the items separator, render the totals block. Each row uses the `.row` class.

Row one (if a cart-level discount was applied): label "Cart Discount" on the left, the discount amount with a leading minus sign on the right, in a `.small` style so it reads as a deduction note rather than a headline figure.

Row two: label "Subtotal" on the left, the subtotal amount on the right.

Row three (if applicable): label "Tax (included)" on the left, the tax amount on the right in `.small` style. For Phase 3, Sri Lankan retail VAT is displayed as an informational line — VelvetPOS does not calculate tax separately; it is assumed to be embedded in the listed prices.

Row four: label "TOTAL" in `.bold` on the left, the `sale.totalAmount` formatted with `formatMoney` on the right, using both `.bold` and `.large` classes. This is the most prominent row in the totals section.

After the TOTAL row, insert a `.separator` `<hr>`.

### Step 9: Payment Summary Section

Below the totals separator, render the payment details section. The header label "Payment" is rendered in a small uppercase muted style.

For each `Payment` record in `sale.payments`, render a `.row` with the method name on the left (render "Cash" if method is `CASH`, render "Card" if method is `CARD`) and the payment amount on the right. If the `Payment` record has a non-null and non-empty `cardReferenceNumber`, render a sub-row below it in `.small` style: "Ref: " concatenated with the reference number.

If the sale's payment method is `CASH` or `SPLIT`, render a "Cash Received" row showing the amount tendered. Derive this value from the Payment record with method `CASH` and the known change amount — or, if the sale object includes a `cashReceived` field from the API response, use that directly. Then render a "Change" row showing the change amount. Apply the `.bold` class to the change label and amount.

After the payment summary, insert a `.separator` `<hr>`.

### Step 10: Thank You Message and Footer

Render the thank-you message from `tenant.receiptFooterMessage` (or `tenant.thankYouMessage` — use whatever field name is established in the Tenant schema from Phase 1). If the field is non-empty, render it in a `<p class="center small">` tag inside a small block with `margin: 4px 0`. If the field is empty or null, render a generic default message: "Thank you for shopping with us!"

After the thank-you message, insert a `.separator` element.

Render the final footer block: a `<p class="center small">` containing the text "Powered by VelvetPOS" on a standalone line, followed on the next line by a small formatted timestamp — "Printed: " concatenated with the current date and time in `DD/MM/YYYY HH:MM` format (this is the time of rendering, not the time of the sale). Use two `<br>` elements or two `<span>` elements in the same `<p>` to separate the two lines.

This footer serves two purposes: it identifies the software powering the store for support purposes, and the print timestamp helps cashiers reconcile reprinted receipts against originals.

---

## Expected Output

- `src/lib/receipt-renderer.ts` created with the `buildThermalReceiptHtml` function and private helpers exported and internally used.
- `GET /api/sales/[id]/receipt` updated in `src/app/api/sales/[id]/receipt/route.ts` to call `buildThermalReceiptHtml` and return the resulting HTML with correct headers.
- Opening `http://localhost:3000/api/sales/[any-valid-id]/receipt` in a browser renders a formatted receipt and triggers the print dialog.

---

## Validation

- Open a valid `GET /api/sales/[id]/receipt` URL in the browser and confirm the receipt renders correctly with all sections visible.
- Verify that the print dialog opens automatically after approximately 200 ms without user interaction.
- Inspect the page at a browser zoom of 100%: the receipt should occupy a width that visually corresponds to 80 mm paper (approximately 302 px at 96 dpi).
- Confirm that all monetary amounts use the `Rs. X,XXX.XX` format consistently throughout the receipt.
- Test with a sale that has a split payment and confirm both the CASH and CARD rows appear in the Payment Summary section with the card reference number below the CARD row.
- Test with a sale that has a cart discount applied and confirm the "Cart Discount" deduction row appears in the Totals section.
- Test with a tenant whose `thankYouMessage` is empty and confirm the generic default message appears.
- Run `pnpm tsc --noEmit` after creating the module and confirm zero type errors.

---

## Notes

- The CSS `@page` `size: 80mm auto` directive is supported in Chromium-based browsers and is fully functional in modern versions of Chrome and Edge, which are the intended print clients for VelvetPOS. Firefox has limited `@page size` support as of 2026 — this is a known limitation and not a bug to fix in Phase 3.
- The 200 ms `setTimeout` before `window.print()` is intentional. Some browsers delay applying `@page` CSS until after the first render pass, and triggering print immediately on `DOMContentLoaded` sometimes results in the browser using the default paper size instead of the configured `80mm` size.
- Do not use any CSS `@import` rules or reference external stylesheets. The receipt HTML must be self-contained because it may be opened on a computer that has only local network connectivity and no internet access.
- The monospace font stack (`Courier New, Courier, monospace`) is chosen deliberately over any design system font. Thermal receipt printers embed their own character sets; monospace fonts ensure that the on-screen preview matches the physical output as closely as possible.
- Product names that exceed 24 characters are truncated to 23 characters plus an ellipsis. This prevents overflow on 32-character-wide thermal paper at a 9pt monospace font. Adjust the default truncation limit here if the actual printer tests show different available character widths.
