# Task 04.03.10 — Build Promotion Auto-Apply in POS

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.03.10 |
| Task Name | Build Promotion Auto-Apply in POS |
| SubPhase | 04.03 — Hardware Integrations and Audit |
| Priority | High |
| Complexity | High |
| Estimated Effort | 3–4 hours |
| Depends On | Promotions Prisma model and promotion CRUD (SubPhase 04.02), POS CartPanel and cart Zustand store (Phase 03) |
| Produces | POST /api/promotions/evaluate, POST /api/promotions/validate-code, updated CartPanel, updated cart Zustand store |

## Objective

Wire automatic promotion evaluation into the POS terminal cart so that applicable promotions are computed and displayed in real time as the cashier modifies the cart. Add a promo code input to the CartPanel so cashiers can manually enter a promotional code for one-off discounts. The cart's applied promotions must be reflected in the sale subtotal, discount, and total calculations.

## Context

The Promotions model was constructed in SubPhase 04.02 with fields sufficient to define rules such as: percentage discount, fixed amount discount, BOGO (buy-one-get-one), minimum subtotal threshold, minimum quantity threshold, applicable product or category scope, valid date range, customer eligibility (all, specific tag, loyalty tier), and promo code (nullable — if null, the promotion is auto-applied; if non-null, it requires explicit code entry). An assumed shape is used here; adapt field names to match the actual schema from SubPhase 04.02.

The evaluation endpoint runs server-side to protect promotion business logic from client-side manipulation. The cart Zustand store calls this endpoint after every cart mutation and stores the returned applied promotions array.

## Instructions

### Step 1: Create the Promotion Evaluation Endpoint

Create src/app/api/promotions/evaluate/route.ts as a POST handler. Authenticate the session (401 if absent). The request body accepts: cartLines (array of objects with productId, variantId, quantity, unitPrice), customerId (string, optional), and tenantId (string, extracted from session for security rather than trusting the body).

Inside the handler, fetch all active promotions for the tenant that satisfy the following criteria: isArchived is false, startDate is less than or equal to now, and endDate is either null or greater than or equal to now, and promoCode is null (auto-apply only — code-based promotions are handled by the validate-code endpoint). Include promotion rule fields in the fetched data.

For each fetched promotion, run the evaluation logic in a local helper function evaluatePromotion(promotion, cartLines, customer). The evaluation logic should check, in sequence:

- Minimum subtotal: if the promotion requires a minimum cart subtotal, calculate the sum of all cartLine.quantity × cartLine.unitPrice and compare it to the threshold. Skip the promotion if not met.
- Product or category scope: if the promotion is scoped to specific products or categories, check whether any cartLine qualifies. Skip if no qualifying lines are present.
- Customer eligibility: if the promotion requires a specific customer tag or loyalty tier, fetch the customer record and check eligibility. Skip if the customer does not qualify or no customer is linked and a customer is required.
- Date validity (already filtered in the query, but double-check in the helper as a guard).

If all conditions pass, compute the discount amount based on the promotion type: for PERCENTAGE, multiply the qualifying subtotal by the percentage rate; for FIXED_AMOUNT, apply the fixed amount capped at the qualifying subtotal; for BOGO, calculate one free item per qualifying pair and apply the unit price of the cheaper item as the discount.

Return an array of applied promotion objects, each with: promotionId, name, type, discountAmount.

Return the array as { appliedPromotions: AppliedPromotion[] } from the endpoint.

### Step 2: Create the Promo Code Validation Endpoint

Create src/app/api/promotions/validate-code/route.ts as a POST handler. Authenticate the session. Accept request body: code (string), cartLines (same shape as above), customerId (string, optional), tenantId from session.

Query promotions where promoCode equals the provided code (case-insensitive, use Prisma's mode: "insensitive" filter), isArchived is false, and the date range is valid. If no promotion is found, return a 404 with { error: "Promo code not found or expired" }.

Run the same evaluatePromotion helper on the found promotion. If the promotion conditions are not met (e.g., cart subtotal below minimum), return a 422 with { error: "Cart does not meet the requirements for this promo code" }. If conditions are met, return the applied promotion object.

### Step 3: Update the Cart Zustand Store

In the cart Zustand store, add a new state field: appliedPromotions typed as an array of AppliedPromotion (import or duplicate the type from the evaluate endpoint). Initialise it as an empty array. Add a derived state field: discountTotal (sum of all appliedPromotion.discountAmount values) and recalculate finalTotal as subtotal minus discountTotal.

Write an async action evaluateAndApplyPromotions that constructs the cartLines array from the current cart items, extracts the current customerId from cart state, and POSTs to /api/promotions/evaluate. On a successful response, set appliedPromotions to the returned array. On error, log a warning and leave appliedPromotions unchanged (do not clear existing applied promotions on network failure).

Call evaluateAndApplyPromotions at the end of every cart mutation action: addItem, removeItem, updateQuantity, linkCustomer, and unlinkCustomer. This ensures promotions are always re-evaluated after each change.

Write a separate action applyPromoCode(code: string) that POSTs to /api/promotions/validate-code. On a 200 response, merge the returned applied promotion into appliedPromotions (avoiding duplicates by promotionId). On a 404 or 422, return the error message so the CartPanel can display it. On network error, return a generic error message.

Write a removePromoCode(promotionId: string) action that filters the applied promotion out of the appliedPromotions array. After removing, trigger evaluateAndApplyPromotions to refresh the auto-apply results (which may change now that a code-based promo is removed).

### Step 4: Update the CartPanel Component

In the CartPanel component (established in Phase 03), add a "Promotions Applied" section below the items list and above the totals row. Render this section only when appliedPromotions.length is greater than zero. For each applied promotion, render a row with: the promotion name on the left and the discount amount formatted with a leading minus sign (e.g., "- RM 10.00") on the right. Use terracotta text colour for the discount amounts to distinguish them visually from item prices.

Add a promo code input row below the items list (or at the top of the totals section). The row contains: an Input field with placeholder "Promo code", a "Apply" Button, and error message text below the input field (hidden when empty, in red when an error is present). On input field Enter key press or "Apply" button click, call the applyPromoCode store action with the current input value. Clear the input field regardless of success or failure. On success, show the applied promotion in the Promotions Applied section. On failure, display the error message below the input field.

Add a small × icon button next to each applied promotion (whether auto-applied or code-applied). Clicking it calls: for code-based promotions, removePromoCode(promotionId); for auto-applied promotions, this button is hidden — auto-applied promotions cannot be manually removed by the cashier (they re-apply anyway on every re-evaluation).

Update the cart totals display: Subtotal row (unchanged), then a Discounts row that appears only when discountTotal is greater than zero (shows "- [discountTotal]" in terracotta), then the Total row showing finalTotal.

## Expected Output

- POST /api/promotions/evaluate returning auto-applied promotions for the current cart state
- POST /api/promotions/validate-code validating a promo code and returning the applied promotion or an error
- Cart Zustand store with appliedPromotions state, discountTotal derived value, and evaluateAndApplyPromotions and applyPromoCode actions
- CartPanel updated with Promotions Applied section, promo code input row, and updated totals display

## Validation

- [ ] Adding an item to the cart triggers a POST to /api/promotions/evaluate
- [ ] A promotion with a minimum subtotal threshold is not applied when the cart is below the threshold, and is applied automatically when the threshold is crossed
- [ ] A promo code that is valid and has met cart conditions applies the discount and shows in the promotions section
- [ ] A promo code that does not exist returns a 404 and the CartPanel shows the error below the input
- [ ] The cart Total row always equals subtotal minus the sum of all discount amounts
- [ ] An auto-applied promotion does not show a remove button in the CartPanel
- [ ] A code-applied promotion shows a × remove button and removing it re-triggers auto-apply evaluation

## Notes

- The evaluate endpoint does not need to account for stacking rules in this phase. Multiple promotions can stack. Stacking limits (e.g., only one discount at a time) are deferred to a future SubPhase
- Evaluate the promotion rules server-side only. Duplicate logic must not be placed in the Zustand store or CartPanel — the client only receives discount amounts, not promotion rules
- If the cart is empty, evaluateAndApplyPromotions should clear appliedPromotions without making a network call
