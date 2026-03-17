# Task 04.02.08 — Build Promotions Management Page

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.02.08 |
| SubPhase | 04.02 — Staff, Promotions and Expenses |
| Complexity | High |
| Estimated Effort | 4–5 hours |
| Depends On | 04.02.07 (promotion service layer and CRUD API routes) |
| Produces | Promotions list page, create/edit promotion form with type-aware field rendering |
| Owner Role | Full-Stack Developer |

---

## Objective

Build the promotions management interface at /dashboard/[tenantSlug]/promotions. This page gives Managers and Owners the ability to create, edit, activate, deactivate, and review promotions. The promotion form adapts its visible fields based on the selected PromotionType, showing only the fields relevant to how the promotion operates.

---

## Context

Six promotion types are supported: CART_PERCENTAGE, CART_FIXED, CATEGORY_PERCENTAGE, BOGO, MIX_AND_MATCH, and PROMO_CODE. Each type uses a different combination of fields. The form must guide the user by hiding irrelevant fields rather than showing all fields at all times and letting the user guess which ones matter. The active/inactive toggle and time window (startsAt/endsAt) are available for all types.

---

## Instructions

### Step 1: Build the Promotions List Page

Create src/app/dashboard/[tenantSlug]/promotions/page.tsx as a server component. Restrict to MANAGER and OWNER roles. Render a page header with the title "Promotions" in Playfair Display, a subtitle showing the count of active promotions, and a "New Promotion" button aligned right. Fetch the initial promotions list server-side and pass it as prefetched data to the TanStack Query client context.

### Step 2: Build the Promotions Table Component

Create src/app/dashboard/[tenantSlug]/promotions/components/PromotionsTable.tsx as a client component. Render a ShadCN Table with columns: Name, Type (as a badge), Value (formatted contextually as percentage or currency depending on type), Promo Code (shown only for PROMO_CODE type), Status (Active/Inactive badge), Valid Window (showing start and end dates or "Always active"), and Actions. Type badges use a consistent colour scheme: CART_PERCENTAGE and CART_FIXED use the sand (#CBAD8D) background, CATEGORY_PERCENTAGE uses the mist (#D1C7BD) background, BOGO and MIX_AND_MATCH use the terracotta (#A48374) background, and PROMO_CODE uses the espresso (#3A2D28) background with pearl text. The Status column renders as a ShadCN Switch that calls the PATCH /api/promotions/[id] endpoint to toggle isActive.

### Step 3: Build the Promotion Form Component

Create src/app/dashboard/[tenantSlug]/promotions/components/PromotionForm.tsx as a client component used by both the create modal and the edit sheet. The form is managed by react-hook-form with a Zod schema. Use a ShadCN Select for the Type field. Render the following fields for all types: Name, Type, Value, Description, startsAt, endsAt, and isActive toggle. Conditionally render these additional fields based on the selected type.

### Step 4: Implement Type-Aware Field Rendering

Within PromotionForm.tsx, use a watch on the type field to conditionally render type-specific fields. When type is PROMO_CODE, show the Promo Code text input. When type is CATEGORY_PERCENTAGE, show a Category selector (a ShadCN Combobox querying /api/categories for the tenant). When type is BOGO or MIX_AND_MATCH, show the Minimum Quantity number input with a label explaining the rule — for BOGO: "Buy this many to get one free" and for MIX_AND_MATCH: "Minimum items from any qualifying products". Use an animated transition (ShadCN Collapsible or a simple CSS height transition) when fields appear or disappear to avoid jarring layout shifts.

### Step 5: Add Value Field Label Adaptation

The Value field label and helper text must adapt based on the selected type. When type is CART_PERCENTAGE or CATEGORY_PERCENTAGE, label the field "Discount (%)" with helper text "Enter a percentage, e.g. 10 for 10% off." When type is CART_FIXED, label it "Discount Amount" with helper text "Enter the fixed amount to subtract from the cart total." When type is BOGO or MIX_AND_MATCH, label it "Item Value Cap" with helper text "Maximum value of the free item. Leave at 0 to use the item's actual price." When type is PROMO_CODE, label it "Discount Value" and show both a percentage and fixed toggle to determine how the value is applied, persisted as a supplementary promotionValueType field stored in the description JSON until a future schema addition formalises it.

### Step 6: Build the Create Promotion Modal

Wrap PromotionForm.tsx in a ShadCN Dialog for the create flow. The "New Promotion" button opens this modal. On submission, call POST /api/promotions, invalidate the promotions list query, close the modal, and show a toast "Promotion created successfully." Validate promo code uniqueness client-side by checking the existing promotions list before submission and showing an inline error if the code already exists.

### Step 7: Build the Edit Promotion Sheet

Wrap PromotionForm.tsx in a ShadCN Sheet (side panel) for the edit flow. Each table row has an "Edit" action in the Actions column. On click, open the Sheet pre-populated with the promotion's current values. On submission, call PATCH /api/promotions/[id], invalidate the query, close the sheet, and show a success toast. Include a "Delete" button at the bottom of the Sheet that opens a ShadCN AlertDialog confirming deletion. On confirmation, call DELETE /api/promotions/[id].

### Step 8: Build the Promotion Preview Card

Within PromotionForm.tsx, add a live preview card that updates as the user fills the form. The preview card uses VelvetPOS typography and palette to render how the promotion will appear to cashiers at the terminal. For example, a CART_PERCENTAGE promotion named "Summer Sale" with value 10 renders as: "Summer Sale — 10% off your entire cart." This gives the manager confidence that the promotion name and value will communicate clearly at the point of sale.

---

## Expected Output

- The promotions page renders a filterable table of all promotions with type badges and status toggles
- The Create modal opens, renders type-adaptive fields, and submits successfully
- The Edit sheet pre-populates with existing values and saves changes
- Type changes in either the modal or sheet cause conditional fields to appear and disappear with transitions
- The live promotion preview card updates in real time as form fields change
- Toggling a promotion's active status from the table works without navigating away

---

## Validation

- Create a PROMO_CODE promotion — confirm the promo code field appears and the code is stored in the database
- Create a CATEGORY_PERCENTAGE promotion — confirm the category selector appears and the targetCategoryId is stored
- Create a BOGO promotion — confirm the minimum quantity field appears and defaults correctly
- Change an existing promotion's type from CART_PERCENTAGE to CATEGORY_PERCENTAGE and save — confirm old type-specific fields are cleared and the new fields are required
- Toggle a promotion to inactive from the table — confirm the switch updates optimistically and the database record reflects isActive false
- Attempt to create a PROMO_CODE promotion with a code that already exists — confirm the inline validation error appears before the request is sent

---

## Notes

- Do not hardcode promotion type display names in the badge rendering. Maintain a lookup map object that maps PromotionType enum values to human-readable labels ("Cart Percentage", "Buy One Get One", etc.) and import it in both the table and the form label for consistency.
- The promotions management page is intentionally separated from the POS terminal screen. Promotions are authored by managers in the operations dashboard and consumed by the terminal through the evaluation API. Changes to promotions take effect on the next cart evaluation cycle without requiring a terminal restart.
