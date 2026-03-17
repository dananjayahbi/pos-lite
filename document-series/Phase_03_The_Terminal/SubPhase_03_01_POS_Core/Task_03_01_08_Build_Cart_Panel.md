# Task 03.01.08 — Build Cart Panel

## Metadata

| Field | Value |
|---|---|
| Task ID | 03.01.08 |
| Task Name | Build Cart Panel |
| Sub-Phase | 03.01 — POS Core |
| Complexity | High |
| Dependency | Task_03_01_05 |
| Output Files | src/components/pos/CartPanel.tsx, src/components/pos/CartLineItem.tsx, src/stores/cartStore.ts |

## Objective

Build the CartPanel component — the right side of the POS terminal — including the scrollable line-items list, discount area, totals section, and action buttons. Build the useCartStore Zustand store that powers all cart state, and establish the decimal.js arithmetic pipeline that ensures precise monetary totals at every step.

## Instructions

### Step 1: Design and Implement the useCartStore Zustand Store

Create src/stores/cartStore.ts. This store is the single source of truth for all in-progress cart state in the POS terminal. Import Zustand's create function and Decimal from decimal.js.

Define the CartItem type as containing: variantId (string), productNameSnapshot (string — captured when the item is added, from the product name in the TanStack Query cache), variantDescriptionSnapshot (string — e.g. "Navy Blue / Large"), sku (string snapshot), unitPrice (Decimal — the retail price at the time of addition), quantity (positive integer minimum 1), and discountPercent (Decimal defaulting to zero).

Define the CartState type containing: items (array of CartItem), cartDiscountPercent (Decimal defaulting to zero — for cart-level percentage discount), cartDiscountAmount (Decimal defaulting to zero — for cart-level fixed-amount discount; one or the other is active at a time), authorizingManagerId (string or null), and activeLineId (string or null — the variantId of the currently selected line for discount input focus).

Define the computed selectors as pure functions (not stored state): subtotal is the sum of lineTotalAfterDiscount for all items where lineTotalAfterDiscount equals (unitPrice × quantity) minus (unitPrice × quantity × discountPercent ÷ 100). The cartDiscountEffective is the cart-level discount expressed as a monetary amount — if cartDiscountPercent is non-zero, compute it as subtotal × cartDiscountPercent ÷ 100; if cartDiscountAmount is non-zero, use cartDiscountAmount directly. The taxAmount computation is a simplified sum: since product-level tax rules are not available in the browser store (tax rule resolution happens server-side in createSale), the terminal displays tax as an approximate line using the store's tenant tax rate setting, loaded as a constant at terminal initialisation. The totalAmount is subtotal minus cartDiscountEffective plus taxAmount. All computed values must use decimal.js arithmetic with ROUND_HALF_UP at two decimal places.

Define the following mutators in the store. The addItem mutator checks if a CartItem with the same variantId already exists in the items array; if it does, increment the existing item's quantity by the new quantity; if not, push a new CartItem with all snapshot fields and discountPercent initialised to zero. The removeItem mutator filters out the CartItem with the matching variantId. The updateQuantity mutator finds the item by variantId and sets its quantity to the provided value, enforcing a minimum of 1. The setLineDiscount mutator finds the item by variantId and sets its discountPercent to the provided Decimal value (validated between 0 and 100). The setCartDiscount mutator accepts a mode ("percent" or "fixed") and a Decimal value, updating the appropriate cart discount field and zeroing the other; it also validates that the value is non-negative. The setAuthorizingManager mutator sets the authorizingManagerId field. The clearCart mutator resets all fields to their initial empty state — items to an empty array, cart discount fields to zero, authorizingManagerId to null, and activeLineId to null. The replaceCart mutator replaces the items array and discount fields with a provided cart snapshot (used when retrieving a held sale). The setActiveLine mutator sets activeLineId to focus the discount control on a specific line.

### Step 2: Build the CartPanel Component Structure

Create src/components/pos/CartPanel.tsx as a client component. It imports useCartStore and all computed selectors. The panel is a flex column that fills 100% of the right panel slot height with no overflow on the panel itself. Its background is pearl (#F1EDE6). The panel is divided into four vertically stacked regions.

The panel header (fixed height, approximately 52px) contains the "Cart" label in Playfair Display at 16px in espresso, a badge showing the total number of line items (distinct variants) in the cart using a terracotta background pill, a "Retrieve" icon button (appearing as a pending badge if any held sales exist for the shift), and a "Clear Cart" text button in the danger colour (#9B2226). The Clear Cart button does not immediately clear the cart — it shows a ShadCN toast with a 3-second undo option ("Cart cleared — Undo" in a bottom notification bar). If the cashier does not click Undo within 3 seconds, clearCart is committed.

### Step 3: Build the CartLineItem Component

Create src/components/pos/CartLineItem.tsx as a client component. Each line item row is approximately 72px tall and contains the following elements arranged horizontally. On the far left, a 40×40px product image thumbnail (or a placeholder icon if no image is available). In the centre, a vertical stack: the product name in Inter at 14px in espresso (truncated with ellipsis if too long), the variant description ("Navy Blue / Large") in Inter at 12px in mist, and the SKU in JetBrains Mono at 11px in a muted mist tone. To the right of the description stack, the quantity stepper (minus button, a compact numerical display, plus button) styled as borderless compact controls in terracotta. Further right, the line total displayed in JetBrains Mono at 14px in espresso bold — this is the lineTotalAfterDiscount value. On the far right, a small × remove button in mist that transitions to danger colour on hover.

Clicking anywhere in the line item row (excluding the stepper and remove button) sets the activeLineId in the store to this item's variantId, which causes the LineItemDiscountControl to reveal below that line. If the same line is clicked again, activeLineId is set to null, collapsing the discount control.

If a line item has a non-zero discountPercent, show a small green discount indicator ("−10%") in small Inter text between the variant description and the SKU, confirming the discount is applied. This helps cashiers verify discounts visually during a busy transaction.

### Step 4: Build the Cart Middle Section

In CartPanel, the middle section (variable height, scrollable) renders the list of CartLineItem components stacked vertically with a hairline mist (#D1C7BD) divider between each one. When the cart is empty, render a centred empty state illustration (a simple shopping bag outline SVG in mist colour) with the text "Cart is empty — add a product to start" in mist Inter at 14px.

Below the line items list and above the totals section, insert the CartDiscountControl component (built in Task 03.01.09). This row shows a "Cart Discount" label and the discount input control. It is always visible once the cart has at least one item.

### Step 5: Build the Totals Section

The totals section sits at the bottom of the CartPanel, fixed in position (it does not scroll away with the line items). Its background transitions to a slightly more opaque pearl with a soft espresso shadow at the top to separate it from the scrollable list above.

The totals section contains the following rows stacked vertically with clear Inter 14px labels on the left and JetBrains Mono 14px amounts on the right. Sub-total: always visible. Discount Amount: shown only when the computed cart-total discount (line discounts plus cart discount combined) is greater than zero, styled in danger colour (#9B2226) with a minus sign prefix. Tax Amount: always visible (even if zero), labelled with the applicable tax rate next to the label for transparency. Total Amount: the final payable figure, displayed in Playfair Display at 22px in espresso bold on the left label, and the monetary amount in JetBrains Mono at 22px terracotta on the right.

All amounts are formatted as "Rs. X,XXX.XX" using a currency formatting utility function that adds comma separators and fixed two-decimal places.

### Step 6: Build the Action Buttons

Below the totals section, render two buttons in a vertical stack each at full width. The "Hold Sale" button uses a sand-coloured (#CBAD8D) border with transparent fill and espresso text; it is shown as disabled if the cart is empty. The "Charge / Pay" button (to be wired to the payment modal in SubPhase 03.02) uses a full espresso fill with pearl text in Inter 16px bold and a 48px height making it a prominent call-to-action; it is disabled if the cart is empty. A disabled state applies 40% opacity to both buttons.

## Expected Output

- src/stores/cartStore.ts with CartItem type, CartState type, all mutators, and all computation-based selectors using decimal.js
- src/components/pos/CartPanel.tsx with all four panel regions (header, scrollable lines, discount row, fixed totals and actions)
- src/components/pos/CartLineItem.tsx with thumbnail, product info, SKU, quantity stepper, line total, remove button, and active-line selection behaviour
- All amounts formatted as "Rs. X,XXX.XX" via a shared currency formatter utility

## Validation

- Adding three items to the cart renders three CartLineItem rows with correct product names, variant descriptions, unit prices, quantities, and line totals
- Updating a line item's quantity (via the stepper) immediately recalculates the line total and updates all totals in the totals section
- Removing a line item via the × button removes it from the cart and updates totals
- The Clear Cart button shows a 3-second undo toast; clicking Undo before expiry restores all cleared items
- The totals section's Total Amount matches the manually computed sum of all line totals minus discounts plus tax, rounded to two decimal places
- When the cart is empty, the "Hold Sale" and "Charge / Pay" buttons are visually disabled and do not respond to clicks

## Notes

- All computed state (subtotal, cartDiscountEffective, taxAmount, totalAmount) must be derived from the items array at read time and never stored as separate fields in the Zustand store. Storing derived state introduces synchronisation bugs that are difficult to debug when quantities or discounts are updated in rapid succession.
- The tax computation in the client store is an approximation using a tenant-wide average tax rate for display purposes. The authoritative tax amount is computed server-side in createSale using per-line tax rules. The subtotal displayed on screen will match the database record; the tax amount may differ by a few rupees if the catalog mixes tax rules. This is clearly labelled as an estimated total on the terminal until payment is initiated.
- Consider persisting the cart store state to localStorage as a safety net against accidental browser refresh during a transaction. The persist middleware from Zustand can be added without changing the store's internal API.
