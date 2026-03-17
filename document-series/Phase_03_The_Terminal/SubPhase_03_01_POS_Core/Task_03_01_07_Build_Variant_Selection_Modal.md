# Task 03.01.07 — Build Variant Selection Modal

## Metadata

| Field | Value |
|---|---|
| Task ID | 03.01.07 |
| Task Name | Build Variant Selection Modal |
| Sub-Phase | 03.01 — POS Core |
| Complexity | Medium |
| Dependency | Task_03_01_06 |
| Output Files | src/components/pos/VariantSelectionModal.tsx |

## Objective

Build the VariantSelectionModal that presents a size-colour matrix (or a flat chip row for single-axis products) when a cashier clicks a multi-variant product tile, allowing the cashier to select a specific variant and add it to the cart with a chosen quantity.

## Instructions

### Step 1: Determine When the Modal Opens

The VariantSelectionModal is triggered by the ProductGrid component when a cashier clicks a product tile that has more than one active (non-deleted) variant. Products with exactly one active variant skip this modal entirely — the variant is added directly to the cart from the tile click with a quantity of 1. The modal receives a productId as its open trigger; on open it derives its display data from the already-cached "pos-products" TanStack Query data rather than making a fresh API call, ensuring the modal appears instantaneously without a loading delay.

### Step 2: Build the Modal Structure

Create src/components/pos/VariantSelectionModal.tsx as a client component using a ShadCN Dialog with max-width of md (448px). The modal has no close button visible in the top-right corner — instead, a small "×" text button sits in the modal header's right side so the cashier can dismiss the modal without adding anything if they clicked the wrong product.

The Dialog header contains the product name in Playfair Display at 18px in espresso. Below the product name, if the product has an image, show a small 64×64px thumbnail of the product image on the left side of the header. Below the header separator, show the current retail price prominently in JetBrains Mono in terracotta, for the currently highlighted (hovered or selected) variant. When no variant is highlighted, show the base retail price from the first available variant.

At the top-right of the modal, above the variant matrix, place a small quantity stepper: a minus button, a numerical display (defaulting to 1), and a plus button. The stepper allows the cashier to select how many units to add before confirming, with a minimum of 1 and a practical maximum of 99. This is particularly useful when selling multiple units of the same size during high-volume periods.

### Step 3: Build the Size-Colour Matrix

Analyse the product's active variants to determine which dimension should be the row axis and which should be the column axis. Prefer whichever axis has fewer distinct values as the column axis (so the matrix is wider than tall, fitting better in the modal width). For a typical clothing product with 3 colours and 5 sizes, use colours as columns and sizes as rows — this produces a 5×3 matrix rather than a 3×5 one.

Render the matrix as a CSS grid with the column count determined by the number of unique column-axis values. The column headers (for example, colour names) sit above the grid in small mist-coloured Inter text. The row headers (size names) sit to the left of the grid in small mist-coloured Inter text. Each cell in the grid is a button component with a fixed size of approximately 72×56px.

Button states for each cell are as follows. A variant cell where stock is greater than 10 shows a clean white background with a thin mist border, hover state transitions to sand background with an espresso border. A variant cell with low stock (between 1 and 10 units) shows a small warning-coloured dot in the top-right corner of the button with the stock count as a number. A variant cell with zero stock shows a grey fill, reduced opacity, a diagonal line overlay or strikethrough, and is rendered as a disabled button so it cannot be clicked. A selected cell (after the cashier taps it) shows an espresso fill with pearl text and a sand border at 2px.

When a cell is hovered, update the SKU display below the matrix to show the specific variant's SKU in JetBrains Mono and update the price display in the header to reflect the hovered variant's retail price (since different variants of the same product may carry different prices in future phases, even if Phase 3 uses a single retail price per product).

### Step 4: Handle Single-Axis Products

If all variants of a product differ only by one attribute (for example, one product only has size variants with no colour differentiation, or only colour variants with no size differentiation), the matrix collapses to a flat chip row. Render a single horizontal row of pill-shaped chip buttons, one per variant, showing the variant descriptor (size name or colour name) and the stock badge where applicable. Out-of-stock chips are greyed and disabled. The selected chip uses espresso fill and pearl text. This single-row layout is used when the number of the non-variant axis is exactly 1 or when the variant descriptor only has one dimension.

### Step 5: Implement Add to Cart Logic

When the cashier clicks an available variant cell (or chip), visually mark it as selected and enable the "Add to Cart" confirmation button at the bottom of the modal. The confirmation button shows "Add [quantity] to Cart" in espresso fill with pearl text, full width. While the variant is selected but before Add to Cart is clicked, the cashier can still adjust the quantity stepper.

Clicking Add to Cart calls the addItem mutation from useCartStore with the selected variant's id, a snapshot of the product name, the variant descriptor, the SKU, the retail price, and the chosen quantity. If the variant is already in the cart, the addItem mutation should increment the existing item's quantity by the chosen amount rather than creating a duplicate cart line. After calling addItem, close the modal and show a brief success toast below the search bar reading "Added [quantity]× [Product Name] [Variant] to cart" in a success-coloured (#2D6A4F) notification bar.

If a cashier clicks an out-of-stock cell, do not add to cart. Instead, show a non-dismissing inline message within the cell tooltip or a small alert beneath the matrix reading "No stock — cannot add to cart." Do not close the modal so the cashier can select a different variant.

### Step 6: Show the SKU and Stock Summary

Below the variant matrix, display a small info row. On the left, show the SKU of the currently selected or hovered variant ("SKU: ABC-001-L-BLU" in JetBrains Mono at 11px). On the right, show the stock level for that variant ("12 in stock" or "2 left" for low stock, or "Out of stock" in danger colour). This row updates in real time as the cashier moves the cursor across the matrix, helping confirm they have the correct item before completing the add.

## Expected Output

- src/components/pos/VariantSelectionModal.tsx fully implemented with size-colour matrix, single-axis flat chip fallback, quantity stepper, cell state transitions, and cart add logic
- Integration with useCartStore.addItem confirmed working
- Success toast shown after adding to cart
- Modal correctly dismissed and no action taken on out-of-stock cell clicks

## Validation

- Clicking a product with three colour variants and four size variants opens the modal showing a 4-row by 3-column grid with correct size and colour labels on the axes
- Clicking a product with only size variants (no colour differentiation) shows a flat chip row rather than a matrix
- Hovering a matrix cell updates the SKU display and price in the modal header
- Clicking a zero-stock cell shows an inline error and does not add to cart or close the modal
- Clicking an in-stock cell, optionally adjusting the quantity stepper, and clicking Add to Cart adds the correct item with the correct quantity to the CartPanel
- If the same variant is added a second time, the quantity on the existing CartPanel line increments rather than a new line being created

## Notes

- The matrix axis orientation logic (fewer distinct values as columns) is a heuristic for common clothing variants. If a product has more than 8 values on either axis, the matrix may still become wide or tall. In Phase 3, no special overflow handling is needed beyond the modal's own scroll. A future enhancement could add sticky axis headers for very large matrices.
- The decision to use the cached TanStack Query data (rather than a fresh fetch) for modal content is deliberate: it ensures the modal appears in under 100ms, which is critical in a busy retail environment where the cashier needs to move quickly. The 5-minute stale time means stock levels shown in the modal may be slightly stale, but this is acceptable since the server-side stock validation in createSale is the authoritative check.
- The addItem mutation in useCartStore must handle the case where the same variantId already exists in the items array. Duplicating cart lines for the same variant creates reconciliation confusion and must not be allowed.
