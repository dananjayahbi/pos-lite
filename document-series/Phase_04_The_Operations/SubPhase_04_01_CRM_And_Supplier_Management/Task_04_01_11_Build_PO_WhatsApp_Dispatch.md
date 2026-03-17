# Task 04.01.11 — Build PO WhatsApp Dispatch

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.01.11 |
| Task Name | Build PO WhatsApp Dispatch |
| SubPhase | 04.01 — CRM and Supplier Management |
| Complexity | Medium |
| Estimated Effort | 2 hours |
| Prerequisites | 04.01.08 (formatPOForWhatsApp), 04.01.09 (PO detail page), `src/lib/whatsapp.ts` from SubPhase 03.02 |
| Output | `src/app/api/purchase-orders/[id]/send-whatsapp/route.ts`, PO detail page button wired up |

---

## Objective

Implement the "Send via WhatsApp" action on the PO Detail page. When a staff member clicks this button, the system formats the purchase order as a plain-text WhatsApp message and sends it to the supplier's WhatsApp number via Meta Cloud API. On success, the PO status advances from `DRAFT` to `SENT`. On failure, an informative error toast is shown and the PO remains in `DRAFT` so the operation can be retried.

---

## Context

The WhatsApp sending infrastructure — the `sendWhatsAppMessage` function in `src/lib/whatsapp.ts` — was established in SubPhase 03.02 for customer-facing receipt notifications. The same function is reused here for outbound supplier communication. No new WhatsApp configuration is required. The `formatPOForWhatsApp` utility function was built in Task 04.01.08. This task is principally about wiring the existing pieces together with appropriate error handling and a clean user experience.

---

## Instructions

### Step 1: Implement the send-whatsapp Route Handler

Open `src/app/api/purchase-orders/[id]/send-whatsapp/route.ts`. This file was stubbed as HTTP 501 in Task 04.01.09. Replace the stub with a full `POST` handler.

Authenticate the request via NextAuth session. Extract `tenantId` and `actorId` (user ID).

Fetch the full PO using `getPOById(tenantId, poId)`. If the PO is not found, return HTTP 404. If the PO's `status` is not `DRAFT`, return HTTP 422 with `{ error: 'Only DRAFT purchase orders can be sent. Current status: [status].' }`. This guard is important — staff should not accidentally re-send a PO that has already been dispatched.

Check that `po.supplier.whatsappNumber` is not null or an empty string. If it is missing, return HTTP 422 with `{ error: 'Supplier has no WhatsApp number configured. Update the supplier record before sending.' }`.

### Step 2: Format the PO Message

Call `formatPOForWhatsApp(po)` from the PO service to obtain the formatted plain-text message string. The function is a pure utility that requires no database call. Log the generated message text at `debug` level in development for easy inspection during testing.

### Step 3: Send via Meta Cloud API

Import `sendWhatsAppMessage` (or the equivalent exported function name) from `src/lib/whatsapp.ts`. Call it with the supplier's `whatsappNumber` as the recipient and the formatted message as the body. Wrap the call in a try-catch:

- On success: proceed to Step 4.
- On failure (network error, API error, rate limit, etc.): log the full error object. Return HTTP 502 with `{ error: 'WhatsApp send failed. Please try again or contact the supplier manually.', detail: errorMessage }`. Do NOT advance the PO status. The PO remains in `DRAFT` so the user can retry the dispatch from the same detail page.

### Step 4: Advance PO Status to SENT

Call `updatePOStatus(tenantId, poId, POStatus.SENT)` from the PO service. This is a simple status update that does not require a full transaction because no stock changes are involved. Return HTTP 200 with `{ success: true, po: updatedPO }`.

### Step 5: Wire the Button on the PO Detail Page

In `src/app/dashboard/[tenantSlug]/suppliers/purchase-orders/[poId]/page.tsx`, locate the "Send via WhatsApp" button rendered for `DRAFT` status POs. Replace the static button with a TanStack Query mutate call:

Use `useMutation` from TanStack Query. The mutation function POSTs to `/api/purchase-orders/[id]/send-whatsapp` (empty body is fine — all needed data is fetched server-side from the PO ID). 

On `onMutate`: set a local `isSending` state to `true` and disable the button to prevent double-clicks. Show a spinner icon inside the button alongside the label "Sending...".

On `onSuccess`: show a ShadCN toast with "Purchase Order sent to [supplier.name] via WhatsApp." with a green checkmark icon. Invalidate the query key `['purchase-order', tenantSlug, poId]` so the status badge on the detail page updates from DRAFT to SENT immediately.

On `onError`: show a ShadCN toast with variant `destructive` and the message from the API error response. Restore the button to its default enabled state. Append a secondary toast action "Contact Supplier" that opens a `tel:` link to the supplier's phone number as a fallback action if WhatsApp fails.

### Step 6: Describe the formatPOForWhatsApp Output

Document the expected output format of `formatPOForWhatsApp` here so this task is self-contained and testable without referencing Task 04.01.08's service code:

The plain-text message is structured as follows: the store name in uppercase on the first line, followed by a line of 30 ASCII dashes, then "PURCHASE ORDER" and the short PO reference on the next line. Below that: "Supplier: [name]", "Expected Delivery: [date or Not specified]", another dash line, then a numbered list of lines each formatted as "[N]. [product] - [variant] | Qty: [qty] | Cost: Rs. [price]", another dash line, "TOTAL: Rs. [totalAmount]", and finally a footer note. Each separator uses 30 standard ASCII hyphens. No Unicode box-drawing characters or emoji are used since WhatsApp renders plain-text messages without guaranteed Unicode display across all devices.

---

## Expected Output

- `src/app/api/purchase-orders/[id]/send-whatsapp/route.ts` — full POST handler replacing the HTTP 501 stub.
- `src/app/dashboard/[tenantSlug]/suppliers/purchase-orders/[poId]/page.tsx` — "Send via WhatsApp" button with mutation, loading state, and error handling.

---

## Validation

- [ ] Sending a DRAFT PO to a supplier with a valid `whatsappNumber` returns HTTP 200 and updates PO status to SENT.
- [ ] Attempting to send a PO with status SENT returns HTTP 422 with the correct error message.
- [ ] Attempting to send a PO whose supplier has no WhatsApp number returns HTTP 422 with the missing-number message.
- [ ] If the WhatsApp API call fails (simulated by temporarily providing an invalid phone number), the PO status remains DRAFT and the button is re-enabled.
- [ ] The button shows a spinner and "Sending..." label during the API call and returns to normal on both success and failure.
- [ ] On success, the status badge on the PO detail page updates to SENT without a full page reload.

---

## Notes

- The `POStatus.SENT` guard in the API route (Step 1) is a server-side enforcement — even if the "Send via WhatsApp" button is hidden for non-DRAFT POs on the frontend, the API must independently validate the status to prevent direct API calls from bypassing the UI restriction.
- If the project already uses a structured error response format (e.g., `{ code, message, detail }`) in other API routes, match that format for the error responses in this route rather than using ad-hoc field names.
- The "Contact Supplier" fallback toast action with a `tel:` link is a low-cost failsafe that significantly improves the user experience when WhatsApp is unavailable — staff can immediately call the supplier without leaving the screen.
- Do not log the formatted WhatsApp message text to any persistent log store because it may contain pricing information that is commercially sensitive.
