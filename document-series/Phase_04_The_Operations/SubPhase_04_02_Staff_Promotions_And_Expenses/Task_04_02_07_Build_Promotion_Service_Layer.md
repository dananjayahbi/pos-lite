# Task 04.02.07 — Build Promotion Service Layer

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.02.07 |
| SubPhase | 04.02 — Staff, Promotions and Expenses |
| Complexity | Very High |
| Estimated Effort | 5–7 hours |
| Depends On | 04.02.01 (Promotion, CustomerPricingRule models), Phase 02 Category, Customer, ProductVariant |
| Produces | promotion.service.ts, promotion evaluate API route |
| Owner Role | Full-Stack Developer |

---

## Objective

Implement the VelvetPOS promotions evaluation engine — a priority-ordered service that examines a cart's contents and returns a list of applicable discounts structured as named discount objects. The engine supports six promotion types and respects manual line discounts applied by cashiers. The result is a deterministic list that the POS cart renders as labels and feeds into the sale completion record.

---

## Context

Promotions are evaluated at cart-calculation time, not at sale completion time. The evaluation result is a snapshot attached to the sale's appliedPromotions field. The priority order is strict and must be enforced consistently: customer-specific pricing rules applied first (these reduce individual line prices), then category percentage discounts, then BOGO and MIX_AND_MATCH rules, and finally cart-level promotions (CART_PERCENTAGE and CART_FIXED). A line that already carries a manual cashier discount is excluded from automatic promotion evaluation — this prevents double discounting and is surfaced to the cashier as a note.

---

## Instructions

### Step 1: Define Service Types

At the top of src/lib/services/promotion.service.ts, define the following TypeScript types. CartLine carries variantId, quantity (integer), unitPrice (Decimal), manualDiscountAmount (Decimal optional), and categoryId (string optional). AppliedDiscount carries promotionId (string), label (string), discountAmount (Decimal), promotionType (PromotionType), and affectedLines (array of variantId strings). EvaluationResult carries appliedDiscounts (array of AppliedDiscount), skippedPromotions (array carrying promotionId and reason), and totalDiscountAmount (Decimal). Import PromotionType from @prisma/client.

### Step 2: Implement the Promotion Fetcher

Create a private async function fetchActivePromotions(tenantId: string) that queries all Promotion records for the tenant where isActive is true and either startsAt is null or less than or equal to now, and either endsAt is null or greater than or equal to now. Return the results grouped loosely by type so the evaluation function can iterate each group in priority order without additional database calls.

### Step 3: Implement Customer Pricing Rule Evaluation

Create a private async function evaluateCustomerPricing that accepts tenantId, cartLines, and customerId. If customerId is null or undefined, return an empty array of discounts. Fetch the customer's tags. Query all active CustomerPricingRule records for the tenant where customerTag matches any of the customer's tags and either variantId is null (applies to all variants) or variantId is in the cart. For each matching rule and matching cart line where rule.price is less than the line's unitPrice, compute the discount as (unitPrice minus rule.price) multiplied by quantity. Create an AppliedDiscount for each such line. Mark each affected cart line as "pricing-rule-applied" to prevent double discounting in later stages.

### Step 4: Implement Category Percentage Evaluation

Create a private function evaluateCategoryDiscounts that accepts cartLines, a list of CATEGORY_PERCENTAGE promotions, and a set of already-discounted variantIds. For each promotion, find cart lines whose categoryId matches promotion.targetCategoryId and whose variantId is not in the already-discounted set and has no manualDiscountAmount. Compute the discount as (unitPrice multiplied by quantity) multiplied by (promotion.value divided by 100) using Decimal arithmetic. Add the promotion to the applied list if any line qualifies. Add affected variantIds to the already-discounted set.

### Step 5: Implement BOGO Evaluation

Create a private function evaluateBOGO that accepts cartLines and BOGO promotions. For a BOGO promotion, any cart line with quantity greater than or equal to promotion.minQuantity (default 2 if null) receives one free unit. The free unit's value equals the unitPrice of that line. Compute discountAmount as the unitPrice of the free unit capped at the total line value. Do not apply BOGO to lines that already have a manual discount or a category discount applied. Add to applied list if qualifying lines are found.

### Step 6: Implement Cart-Level Promotion Evaluation

Create a private function evaluateCartPromotions accepting cartLines, cart subtotal (sum of all line totals after previous discounts), and cart-level promotions (CART_PERCENTAGE and CART_FIXED). For CART_PERCENTAGE, compute the discount as the subtotal multiplied by (promotion.value divided by 100). For CART_FIXED, the discount is directly promotion.value but capped at the current subtotal so the total never goes negative. Apply only the highest-value qualifying cart-level promotion (do not stack multiple cart percentage promotions — apply the most favourable one and mark others as skipped with reason "lower value cart promotion").

### Step 7: Implement validatePromoCode

Create an exported async function validatePromoCode(tenantId: string, code: string, cartLines: CartLine[]) that trims the code, converts to uppercase for case-insensitive matching, and queries PROMO_CODE promotions where promoCode equals the normalised code and isActive is true and the time window is valid. If no match is found, return a structured error object with code "PROMO_NOT_FOUND". If found, evaluate the promotion against the cart lines using the relevant evaluation function and return the AppliedDiscount. If the cart does not meet any qualifying conditions (e.g., CATEGORY_PERCENTAGE code but no matching category lines), return a structured error with code "PROMO_NOT_APPLICABLE" and a human-readable reason.

### Step 8: Implement evaluatePromotions

Create the main exported async function evaluatePromotions(tenantId: string, cartLines: CartLine[], customerId?: string, appliedPromoCode?: string) that orchestrates the full evaluation pipeline. Call fetchActivePromotions once. Run customer pricing evaluation first. Collect the variantIds of affected lines. Run category discount evaluation next, skipping already-discounted lines. Run BOGO and MIX_AND_MATCH evaluations. Run cart-level evaluations on the remaining cart subtotal. If appliedPromoCode is provided and not already handled by active promotions, call validatePromoCode and add its result if valid. Collect all skipped promotions with reasons. Compute the total discount amount as the sum of all AppliedDiscount.discountAmount values. Return an EvaluationResult.

### Step 9: Create the Evaluate API Route

Create src/app/api/promotions/evaluate/route.ts with a GET handler. Accept cartLines as a JSON-encoded query parameter and customerId and promoCode as optional string parameters. Parse and validate cartLines with Zod. Extract tenantId from the authenticated session. Call evaluatePromotions. Return the EvaluationResult. Include cache headers of no-store since promotion state changes in real time and cached responses could deliver incorrect discounts.

### Step 10: Implement CRUD Functions

Add exported async functions createPromotion, updatePromotion, and togglePromotion (flips isActive) that perform straightforward Prisma create and update operations with Zod validation. Expose these through src/app/api/promotions/route.ts (GET list and POST create) and src/app/api/promotions/[id]/route.ts (PATCH update, DELETE toggle). Enforce MANAGER/OWNER roles on all mutation endpoints.

---

## Expected Output

- promotion.service.ts exports evaluatePromotions, validatePromoCode, createPromotion, updatePromotion, togglePromotion, and getPromotions
- GET /api/promotions/evaluate returns an EvaluationResult with correct discounts applied in priority order
- Manual line discounts cause their lines to be excluded from promotion evaluation, and those promotions appear in skippedPromotions
- CART_PERCENTAGE and CART_FIXED do not stack and the most favourable is chosen
- validatePromoCode returns a structured error when the code is invalid or not applicable

---

## Validation

- Add items from category A and category B to the cart; apply a CATEGORY_PERCENTAGE promotion for category A — confirm only category A lines are discounted
- Add two of the same item with a BOGO promotion; confirm the discount equals one unit price
- Apply a CART_PERCENTAGE and a CART_FIXED promotion simultaneously — confirm only the higher-value one is applied and the other appears in skippedPromotions
- Apply a manual cashier discount to a cart line, then re-evaluate — confirm the promotion for that line appears in skippedPromotions with reason "manual discount applied"
- Submit an invalid promo code — confirm the API returns code "PROMO_NOT_FOUND" without a 500 error

---

## Notes

- The evaluation engine is designed to be deterministic — the same cart and active promotions must always produce the same EvaluationResult. Avoid any randomness or timestamp-dependent logic within the evaluation functions themselves.
- All monetary intermediate values during evaluation must use Decimal arithmetic. Accumulating floating-point errors across multiple discount rounds on a large cart would produce incorrect totals.
- Mix-and-match evaluation follows the same logic as BOGO but uses a configurable minQuantity from multiple different product variants. Implement MIX_AND_MATCH as a variant of the BOGO evaluation step, gated on whether the promotion type is MIX_AND_MATCH and treating the qualifying quantity as being spread across multiple variantIds.
