# Task 04.02.09 — Build POS Terminal Promotions Integration

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.02.09 |
| SubPhase | 04.02 — Staff, Promotions and Expenses |
| Complexity | High |
| Estimated Effort | 4–5 hours |
| Depends On | 04.02.07 (promotion service layer), Phase 03 cart store and sale API |
| Produces | Updated cart Zustand store with promotion state, CartPanel promotion labels, promo code input |
| Owner Role | Full-Stack Developer |

---

## Objective

Integrate the promotions evaluation engine into the Phase 03 POS terminal cart flow. After every cart change — adding, removing, or updating a line item — the cart store calls the promotions evaluate endpoint and stores the result as part of the cart state. Applied promotion labels appear beneath each affected line item and a summary of all active discounts is shown in the cart totals section. The cashier can enter a promo code in the CartPanel footer.

---

## Context

The Phase 03 cart store is a Zustand store managing cartLines, cartTotals (subtotal, taxAmount, total), and the current customerId. This task adds appliedPromotions and skippedPromotions to the cart state, along with an evaluateAndUpdatePromotions action. The sale completion API must be updated to accept and persist the appliedPromotions array in Sale.appliedPromotions. All promotion evaluation is non-blocking — cart mutations proceed immediately and promotion state updates asynchronously.

---

## Instructions

### Step 1: Extend the Cart Store Type Definitions

Open src/store/cart.store.ts. Add appliedPromotions as an array of AppliedDiscount (import the type from the promotion service) to the CartState type. Add skippedPromotions as an array of skip objects containing promotionId and reason. Add totalDiscountAmount as Decimal. Add appliedPromoCode as string or null. Add isEvaluatingPromotions as boolean (used to show a loading indicator). Add evaluatePromotions as an action method and setPromoCode as an action method.

### Step 2: Implement the evaluatePromotions Action

Within the Zustand store, implement the evaluatePromotions action as an async function. When called, set isEvaluatingPromotions to true. Serialize the current cartLines (variantId, quantity, unitPrice, manualDiscountAmount, categoryId) into a query string. Call GET /api/promotions/evaluate with the serialised cartLines, the current customerId if set, and the appliedPromoCode if set, using the fetch API. On success, update appliedPromotions, skippedPromotions, and totalDiscountAmount from the EvaluationResult. Set isEvaluatingPromotions to false. On network error, set isEvaluatingPromotions to false and leave the previous promotion state unchanged — do not clear previous promotions on a transient network failure, as removing discounts mid-transaction would confuse the cashier.

### Step 3: Wire evaluatePromotions to Cart Mutations

In each of the Zustand actions that modify cart lines — addLine, removeLine, updateLineQuantity, applyManualDiscount — add a call to evaluatePromotions after the synchronous state update. The call must be fire-and-forget from the action's perspective (the action remains synchronous for the cart mutation, but the promotion update happens in the background). Use a short debounce of 300 milliseconds to prevent rapid successive evaluation calls when a cashier quickly increments a quantity multiple times.

### Step 4: Build the PromotionLabelList Component

Create src/app/terminal/[tenantSlug]/components/PromotionLabelList.tsx as a client component. Accept an array of AppliedDiscount objects filtered to a specific variantId as props. Render each applied discount as a small pill beneath the line item. Style the pill with a linen (#EBE3DB) background, a sand (#CBAD8D) left border, and Inter typography at 11px. Display the label string and the discountAmount formatted as a negative currency value (e.g., "Summer Sale —$2.50"). If isEvaluatingPromotions is true, show a subtle loading skeleton in place of the pills.

### Step 5: Integrate PromotionLabelList into CartLine Rows

Open the CartLineRow component from Phase 03. After the existing line total display, render the PromotionLabelList component, passing the appliedPromotions from the cart store filtered to those where affectedLines includes the current variantId. This renders the discount labels directly under the relevant product on the line level.

### Step 6: Build the PromoCodeInput Component

Create src/app/terminal/[tenantSlug]/components/PromoCodeInput.tsx as a client component. Render a compact text input labelled "Promo Code" with a sand (#CBAD8D) border and JetBrains Mono font for the input value. Include an "Apply" button. On apply, call the setPromoCode action in the cart store and trigger evaluatePromotions immediately (bypassing the debounce). If the promotion evaluation returns a PROMO_NOT_FOUND or PROMO_NOT_APPLICABLE error in skippedPromotions, display the error message beneath the input in terracotta text. If the code is applied successfully, show the code in a removable chip with an × button that calls setPromoCode(null) and re-evaluates. Render the PromoCodeInput in the CartPanel footer area, above the totals block.

### Step 7: Build the Promotion Summary Section in Cart Totals

In the CartPanel totals block from Phase 03, add a "Discounts" section between the Subtotal row and the Tax row. If totalDiscountAmount is greater than zero, render each applied promotion as a row with its label and discount amount in a colour that clearly distinguishes it from the sale lines — use sand (#CBAD8D) text for promotion labels and a darker espresso (#3A2D28) for the discount amounts formatted with a leading minus sign. Show a "Total Discounts" row summing all discount amounts. If skippedPromotions is non-empty, add a collapsible "Promotions Not Applied" section showing each skipped promotion and its reason in a subdued mist (#D1C7BD) colour.

### Step 8: Update the Sale Completion API

Open the POST /api/sales route from Phase 03. Accept an appliedPromotions field in the request body as a Json nullable value. Validate using Zod (allow the field to be missing for backward compatibility). When creating the Sale record, write the appliedPromotions array to Sale.appliedPromotions. Update the cart store's completeSale action to pass the current appliedPromotions array to the API.

---

## Expected Output

- Cart store carries appliedPromotions, skippedPromotions, totalDiscountAmount, appliedPromoCode, and isEvaluatingPromotions
- Every cart line change triggers a debounced promotion evaluation
- Applied promotions appear as labelled pills beneath each affected line item
- The promo code input validates and applies codes end-to-end
- The cart totals section shows a Discounts breakdown
- Sale completion persists the appliedPromotions array in Sale.appliedPromotions

---

## Validation

- Add two items with an active CART_PERCENTAGE promotion — confirm the discount pill appears under both lines and the total discounts row updates in the totals block
- Remove one of the items — confirm the promotion pills re-evaluate and the discount amount updates
- Enter a valid PROMO_CODE in the promo code input — confirm the discount pill appears and the totals reflect the reduction
- Enter an invalid code — confirm the error message appears beneath the input without affecting cart totals
- Complete a sale — confirm Sale.appliedPromotions in the database contains the serialised promotion array matching what was displayed at the terminal
- Simulate a network error during evaluation — confirm the UI does not clear existing promotion pills

---

## Notes

- The debounce delay of 300 milliseconds is a balance point between responsiveness and API call frequency. If performance profiling shows the evaluate endpoint is called too often on fast scanners, increase the debounce to 500 milliseconds.
- The promotion evaluation must never block the cashier from completing a sale. If the evaluation endpoint is unreachable, the cart should proceed to sale completion without promotions rather than blocking. Log a warning in the browser console in this case.
- Sale receipt rendering from Phase 03 should be updated to read and display appliedPromotions from the completed Sale record, showing the discount breakdown on the printed or displayed receipt.
