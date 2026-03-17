# Task 02.02.08 — Build Barcode Label Printing

## Metadata

| Field        | Value                                                    |
| ------------ | -------------------------------------------------------- |
| Task ID      | Task_02_02_08                                            |
| Sub-Phase    | 02.02 — Product Management UI                           |
| Complexity   | Medium                                                   |
| Depends On   | Task_02_02_04                                            |
| File Targets | src/components/inventory/BarcodeLabelDialog.tsx, src/components/inventory/BarcodeLabel.tsx |

---

## Objective

Build the Barcode Label Printing feature that allows staff to generate and print adhesive product labels directly from the browser. Labels can be triggered from two entry points: the Variants tab of the Product Detail page and the Inventory List page. The feature supports both 4 cm × 6 cm thermal label printers and standard A4 paper.

---

## Instructions

### Step 1: Define the Label Entry Points

On the Product Detail page Variants tab, add a "Print Labels" secondary button (sand outline) in the toolbar above the variants table. When one or more variant checkboxes are selected, this button becomes active and shows the count: "Print Labels (3)". Clicking it with no checkboxes selected shows a toast "Select at least one variant to print labels."

On the Inventory List page, add a "Print Labels" option to the BulkActionBar (built in Task_02_02_07) alongside the existing action buttons. This option collects all variants from the selected products (potentially many variants) rather than individual variants.

Both entry points pass an array of variant objects to the BarcodeLabelDialog component.

### Step 2: Build the BarcodeLabelDialog Component

Create src/components/inventory/BarcodeLabelDialog.tsx. This is a wide ShadCN Dialog (minimum 700 px width) with the title "Print Barcode Labels" in Playfair Display. The Dialog body is split into two sections: a left panel showing the label preview grid and a right panel showing the print settings.

The settings panel on the right contains:

- A paper size selector with two radio options: "Thermal (4 × 6 cm)" and "A4 Sheet". The default selection is Thermal.
- An informational note: "A4 mode prints 4 labels per row, 8 rows per page — 32 labels per sheet."
- A per-variant quantity stepper list (described in Step 4).

The label preview panel on the left shows a live preview of the first label in the selection, rendered using the BarcodeLabel component. The preview updates if the selected paper size changes.

### Step 3: Build the BarcodeLabel Component

Create src/components/inventory/BarcodeLabel.tsx. This component renders the visual layout of a single printed label. When rendered on screen (inside the Dialog preview), it displays at 150% scale for readability. When rendered inside the hidden print container, it renders at exact physical dimensions.

The label layout from top to bottom:

- Brand name: Inter 8 px, espresso colour, left-aligned, top of the label
- A thin 1 px mist horizontal rule below the brand name
- Product Name: Playfair Display 11 px, espresso, left-aligned, wrapping to two lines maximum
- SKU: JetBrains Mono 9 px, espresso, left-aligned. The prefix "SKU:" is in mist colour
- Size and Colour: Inter 8 px, mist colour, in the format "Size: M · Colour: Midnight Blue"
- Barcode image: rendered as an inline SVG using the react-barcode package (or a direct SVG-based Code128 rendering utility). The barcode string comes from the variant's barcode field. If the barcode field is empty, fall back to encoding the SKU as the barcode value. The barcode is centred horizontally with 4 px margins on either side
- A 4 px gap below the barcode
- Retail Price: Playfair Display 14 px, espresso, right-aligned, bold, formatted as "Rs. 1,250.00". This is the largest text element on the label for quick visual scanning
- A low-stock dot: if the variant's stockQuantity is at or below its lowStockThreshold, render a small 8 px filled circle in warning colour (#B7791F) to the left of the retail price on the same baseline row. This gives pickers visual awareness without cluttering the label for normal-stock items

The entire label component is bounded by a 4 cm × 6 cm box in print mode. On screen (preview), it is bounded by a 160 × 240 px container with an espresso 1 px border and a mist-colour background.

### Step 4: Build the Quantity Stepper List

The right panel of the Dialog shows one row per variant in the selection. Each row shows the variant's SKU (JetBrains Mono compact), size and colour in Inter small, and a quantity stepper on the right. The stepper contains a decrement button (−), a numeric input field, and an increment button (+). The default quantity is 1. The minimum is 1 and the maximum is 99. The total label count across all variants is shown below the list: "Total: [N] labels."

When quantities are changed, the total updates reactively via a derived sum reducer in local component state.

### Step 5: Implement the Print Mechanism

The Dialog footer contains: "Cancel" (mist ghost) and "Print Labels" (espresso fill). Clicking "Print Labels" does the following:

First, build the print payload: an array of objects each containing the variant data and the quantity for that variant. Expand this array into a flat list of label copies — if a variant has quantity 3, it appears three times in the flat list.

Second, populate a hidden print-only div in the DOM. This div has an id of "barcode-print-container" and is positioned off-screen using absolute positioning (not display:none, which would prevent printing). The div contains the label grid: BarcodeLabel components laid out in a CSS grid with the appropriate column count based on paper size (1-per-row for thermal, 4-per-row for A4).

Third, add a @media print CSS rule (via a style tag or a global print.css file) that hides everything on the page except the element with the id "barcode-print-container", and applies page-break-after: always after every [columns × rows] label group to ensure correct pagination on A4.

Fourth, call window.print() to open the browser's native print dialog.

After the print dialog closes (there is no reliable cross-browser print completion event, so treat the window.print() call itself as the trigger), close the BarcodeLabelDialog.

### Step 6: Handle Missing Barcodes

If a variant has no barcode value and no SKU value, the BarcodeLabel component should gracefully render a placeholder message in mist italic: "No barcode available" in place of the barcode SVG. This prevents a rendering crash when a variant was imported without these values.

---

## Expected Output

Selecting variant checkboxes on the Product Detail Variants tab and clicking "Print Labels" opens the dialog showing label previews and quantity steppers. Adjusting quantities updates the total label count. Clicking "Print Labels" opens the browser print dialog with the labels correctly formatted. On A4, four labels appear per row. On thermal, one label per row. The print preview shows only the label grid, with no navigation bars or sidebars.

---

## Validation

- Dialog opens only when at least one variant is selected; clicking without selection shows the toast
- BarcodeLabel component renders all six content sections (brand, rule, name, SKU, size/colour, barcode, price)
- Barcode SVG encodes the variant's barcode value; falls back to SKU if barcode is empty
- Low-stock warning dot appears when stockQuantity is at or below lowStockThreshold
- Quantity stepper enforces minimum 1 and maximum 99
- Total label count updates when any quantity stepper changes
- A4 paper size selection causes the grid to use 4 columns in the print container
- Thermal paper size selection causes the grid to use 1 column
- window.print() is called after the print container is populated
- Dialog closes after window.print() call completes

---

## Notes

- The @media print CSS must use !important overrides liberally — the ShadCN Tailwind base styles include display rules that will interfere with the print layout if not explicitly overridden
- The hidden print container should be cleaned up (innerHTML cleared) after each print call to prevent stale label data accumulating in the DOM across multiple print sessions
- If the react-barcode package is used, it renders a canvas or SVG element. Prefer the SVG output mode for print fidelity — canvas elements can appear blurry on high-DPI printers
