# Task 03.01.09 — Build Discount System

## Metadata

| Field | Value |
|---|---|
| Task ID | 03.01.09 |
| Task Name | Build Discount System |
| Sub-Phase | 03.01 — POS Core |
| Complexity | High |
| Dependency | Task_03_01_08 |
| Output Files | src/components/pos/LineItemDiscountControl.tsx, src/components/pos/CartDiscountControl.tsx, src/components/pos/CartManagerPINModal.tsx |

## Objective

Implement the complete discount authorisation system covering both line-item and cart-level discounts: threshold-based permission checks tied to RBAC roles, a Manager PIN modal with a numeric keypad for override authorisation, and the recording of the authorising manager's identity in the cart store for later persistence in the sale record.

## Instructions

### Step 1: Understand the Discount Threshold Rules

Before building any component, clearly establish the discount rules that all UI components in this task must enforce. A CASHIER-role user may apply a discount of up to 10% on any single line item without further authorisation. A CASHIER may apply a cart-level discount of up to 5% without further authorisation. Any line item discount exceeding 10% or any cart discount exceeding 5% applied by a CASHIER requires a Manager PIN override. MANAGER and OWNER role users face no thresholds — they may enter any discount percentage directly without a PIN prompt. These thresholds are hard-coded constants in a shared configuration module (for example src/config/pos.config.ts) so they can be changed in one place in a future phase without searching across multiple component files.

The current user's role is available from the session via the NextAuth useSession client hook. Pass it down as a prop to both discount control components, or read it inside each component using useSession directly.

### Step 2: Build the LineItemDiscountControl Component

Create src/components/pos/LineItemDiscountControl.tsx as a client component. This control appears as a collapsible panel that slides open below the active CartLineItem row (the one whose variantId matches the activeLineId in the cart store). Implement the reveal using a CSS height transition from 0 to the auto height using a max-height approach, with a 200ms ease-in-out transition.

The control contains two sections arranged horizontally. On the left, a mode toggle with two pill buttons: "%" for percentage mode and "Rs." for fixed-amount mode. Clicking a toggle button switches the active mode and clears the input value. The active mode button uses a sand fill; the inactive one uses a transparent fill with mist border. On the right, a number input that accepts positive decimal values with two decimal places. The input has a maximum width of 100px and uses Inter font with espresso text.

Below the input, show a live preview line reading "New line total: Rs. X,XXX.XX" computed from the current input value and the line's original lineTotalBeforeDiscount. This gives the cashier an immediate visual confirmation before applying the discount. If the entered discount would reduce the line total below zero, show an inline validation error "Discount exceeds line total" and disable the apply button.

The permission boundary works as follows. When the user role is CASHIER and the input value in percentage mode exceeds 10 (for example, the cashier types 12), apply a warning style to the input border (warning colour #B7791F) and replace the normal "Apply" confirmation button with a button labelled "Request Manager Override" in warning-coloured text. Clicking Request Manager Override opens the CartManagerPINModal, passing a callback that, on successful Manager PIN verification, calls setLineDiscount in the cart store with the desired discount percent and closes both the PIN modal and the discount control panel.

When the user role is MANAGER or OWNER, the "Request Manager Override" path never triggers — the discount is applied directly regardless of value.

When the role is CASHIER and the input is at or below 10%, a standard "Apply" button in espresso fill confirms the discount immediately by calling setLineDiscount.

In fixed-amount mode, convert the fixed amount to a percentage of the line's lineTotalBeforeDiscount before storing: divide the fixed amount by lineTotalBeforeDiscount and multiply by 100 to obtain the equivalent percentage. Store this percentage in the cart store to maintain data consistency (the store uses percentage as the canonical discount representation for every line item). The conversion ensures the same permission threshold logic (10% check) applies uniformly whether the cashier entered a percentage or a fixed amount.

### Step 3: Build the CartDiscountControl Component

Create src/components/pos/CartDiscountControl.tsx as a client component rendered in the CartPanel below the line items and above the totals section. It is always visible when the cart has at least one item.

The control layout mirrors the LineItemDiscountControl: a mode toggle (% vs Rs.), a number input, and a live preview showing the new total after the cart discount. Label the control with "Cart Discount" in Inter 13px mist on the left.

The permission boundary for cart discount: when the user role is CASHIER and the input percentage exceeds 5, apply the warning style and show "Request Manager Override" in place of the Apply button. For fixed-amount mode, convert the amount to a percentage of the current subtotal (not the final total, since tax is added after disc) to check against the 5% threshold. The same CartManagerPINModal flow applies: on successful PIN entry, call setCartDiscount in the cart store with the authorised percentage, and call setAuthorizingManager with the returned managerId.

When the cart discount is set to a non-zero value, the CartPanel's totals section shows the "Discount Amount" row styled in danger colour. Clearing the cart discount input (setting it back to empty or zero) revokes the discount and removes the row from the totals display. Clearing the discount also clears the authorizingManagerId in the store, since the authorisation is only valid for the specific discount that was approved.

### Step 4: Build the CartManagerPINModal

Create src/components/pos/CartManagerPINModal.tsx as a client component using a ShadCN Dialog with max-width sm (384px). This modal opens when a CASHIER triggers a discount that exceeds their threshold. The purpose of the modal is clear from its context — the cashier physically hands the device to a manager or owner, who enters their PIN to authorise the override, then hands it back.

The modal header reads "Manager Authorisation Required" in Playfair Display at 17px, with a sub-heading in mist Inter text explaining what is being authorised (for example "Authorise 15% line discount on Silk Blouse / White / M" — constructed from the pending discount context passed as a prop to the modal).

Below the header, render a numeric PIN pad in a 3×4 grid layout (1-9 in three rows of three, then 0 in the bottom centre, a backspace button in the bottom right, and a submit button in the bottom left). Each button is a large, touch-friendly 64×64px square with mist border and espresso text. The PIN display at the top of the pad shows four filled or empty dot indicators (●/○) representing the entered digits — never show the actual digit characters in the display for security. Use a local state array to accumulate the entered digits; the backspace button removes the last entry.

When the submit button is pressed (or the fourth digit is entered automatically), call POST /api/auth/verify-pin with the entered PIN as the request body. Do not log or expose the PIN in any client-side error state or analytics. The API endpoint must hash the provided PIN and compare it against stored User PIN hashes (use bcrypt comparison), returning the userId and role of the matching manager if successful.

On a successful response: extract the managerId and role from the response. Validate that the returned role is MANAGER or OWNER — if a CASHIER-role user's PIN is entered, reject the authorisation with the same error state as an incorrect PIN. Call the onSuccess callback passed as a prop to the modal, providing the managerId. The parent component then calls setAuthorizingManager(managerId) in the cart store and applies the pending discount. Close the modal.

On an incorrect PIN: do not immediately close the modal. Trigger a brief shake animation on the PIN pad dot display (a horizontal CSS keyframe animation translating ±6px twice over 300ms). Clear the entered digits array and allow the manager to reattempt. After three consecutive failures, close the modal and show a toast notification "Manager authorisation failed — please try again" in the danger colour, preventing brute-force attempts within a single session. Reset the failure counter when the modal is reopened.

### Step 5: Build the POST /api/auth/verify-pin Endpoint

Create src/app/api/auth/verify-pin/route.ts. This endpoint accepts a POST request with a JSON body containing a pin field (string, 4-digit numeric). Authenticate the request using getServerSession to confirm it is being called from an active session. Do not require any specific role on the caller — this endpoint is intentionally callable by a CASHIER since they are the ones initiating the PIN verification flow on behalf of their manager.

Query the User table for all users with a non-null hashedPin field who belong to the same tenant as the session caller. For each candidate user, compare the provided PIN against their hashedPin using bcrypt.compare. Return the first match's userId and role. If no match is found after checking all candidates, return a 401 response with a generic "Invalid PIN" message — do not reveal whether a PIN was found but belonged to a CASHIER. Rate-limiting this endpoint is important: add a simple in-memory or Redis-backed rate limiter allowing a maximum of five failed attempts per session token per minute to prevent rapid brute-force automated calls.

## Expected Output

- src/components/pos/LineItemDiscountControl.tsx with mode toggle, live preview, CASHIER threshold check, and Manager PIN override flow
- src/components/pos/CartDiscountControl.tsx with mode toggle, 5% CASHIER threshold check, and Manager PIN override flow
- src/components/pos/CartManagerPINModal.tsx with numeric PIN pad, dot indicator display, bcrypt-verify API call, shake animation on failure, and three-attempt lockout
- src/app/api/auth/verify-pin/route.ts with bcrypt PIN comparison, tenant-scoped user lookup, and rate limiting

## Validation

- A CASHIER user typing 8% in the LineItemDiscountControl shows the Apply button and applies the discount without a PIN prompt
- A CASHIER user typing 12% shows the "Request Manager Override" button in warning colour; clicking it opens the CartManagerPINModal
- Entering a correct MANAGER PIN in the modal closes the modal, applies the 12% discount, and sets authorizingManagerId in the cart store to the manager's userId
- Entering an incorrect PIN triggers the shake animation and clears the input without closing the modal
- Three consecutive incorrect PIN entries close the modal and show a danger toast
- A MANAGER-role user typing any discount percentage in the LineItemDiscountControl sees only the Apply button — the override flow never triggers
- The cart-level discount applies the 5% threshold for CASHIER and bypasses it for MANAGER/OWNER
- The authorizingManagerId value in the cart store matches the userId returned by the verify-pin API after a successful override

## Notes

- The PIN pad must never echo actual digit characters in the display. Only the filled/empty dot indicators are shown. This prevents shoulder surfing in a retail environment where the terminal faces customers or bystanders.
- The verify-pin endpoint intentionally returns a generic error for both "PIN not found" and "PIN belongs to a non-manager". This prevents a CASHIER from deducing which staff members have PINs set by observing different error responses.
- The authorizingManagerId audit trail creates a verifiable record of every manager-approved discount override, linkable to the specific manager who authorised it. This is a core accountability mechanism that must not be bypassed or made optional.
- The in-memory rate limiter is sufficient for Phase 3 since VelvetPOS is a single-instance deployment in the initial launch phase. If the service scales to multiple instances, replace the in-memory rate limiter with a Redis-backed solution in Phase 05.
