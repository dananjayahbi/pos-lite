# Task 03.02.07 — Build WhatsApp Receipt Dispatch

## Metadata

| Field | Value |
|---|---|
| Task | 03.02.07 |
| Name | Build WhatsApp Receipt Dispatch |
| Sub-Phase | 03.02 — Payments, Receipts & Offline Mode |
| Complexity | Medium |
| Depends On | Task_03_02_06 |
| Produces | src/lib/whatsapp.ts, src/app/api/sales/[id]/send-receipt/route.ts |

## Objective

Implement WhatsApp receipt dispatch using the Meta Cloud API with pre-approved message templates. The integration allows the cashier to dispatch a receipt to the customer's WhatsApp number from the Receipt Preview Dialog after a sale is completed. The dispatch is fire-and-forget — a failure never blocks, reverses, or delays the completed sale.

## Instructions

### Step 1: Document the Required Environment Variables

Before writing any application code, update the .env.example file in the project root. Add the following three entries with descriptive comments.

WHATSAPP_PHONE_NUMBER_ID should have a comment reading: "Numeric ID for your WhatsApp Business phone number. Found in Meta Business Manager under WhatsApp > Phone Numbers." WHATSAPP_ACCESS_TOKEN should have a comment reading: "System user access token or temporary token from Meta Developer console. Never commit a real value here." WHATSAPP_TEMPLATE_NAME should have a comment reading: "Exact name of the approved WhatsApp Business message template. The template must be approved in Meta Business Manager and must contain exactly four variable placeholders: {{1}} store name, {{2}} sale reference, {{3}} items summary, {{4}} total amount."

Add a comment block above the three variables explaining that the WhatsApp integration uses the Meta Cloud API (not Twilio). Direct developers to the Meta for Developers documentation for template approval guidance. Note that in development, any phone number added as a test contact in the Meta developer sandbox will receive messages without a template approval requirement.

### Step 2: Create the WhatsApp Module

Create the file src/lib/whatsapp.ts. Begin with a module-level comment stating that this module provides WhatsApp Business messaging via the Meta Cloud API v18.0. All exported functions are safe to call from server-side code (Next.js API routes and server actions) but should never be imported in client-side components, because they reference server environment variables.

Define and export a TypeScript interface called WhatsAppReceiptPayload. Its fields: storeName (string), saleReference (string — the short 8-character uppercase sale identifier shown on the receipt), itemsSummary (string — a pre-formatted compact text summary of the purchased items), and totalAmount (string — pre-formatted with the "Rs." prefix and two decimal places, e.g. "Rs. 3,750.00"). This interface accepts pre-formatted strings rather than raw data types to keep all formatting logic centralised in the caller — the route handler constructs these strings before calling the dispatch function.

### Step 3: Implement formatReceiptTemplateComponents

Implement the formatReceiptTemplateComponents function. It accepts a WhatsAppReceiptPayload parameter and an optional language code string (defaulting to "en"). The function returns the Meta API template components array in the format expected by the API.

The return value is an array with a single element: a component object with type "body" and a parameters array. The parameters array contains four objects, each with type "text" and a text value. Parameter index 0 corresponds to template variable {{1}} and its text is storeName. Parameter index 1 corresponds to {{2}} and its text is saleReference. Parameter index 2 corresponds to {{3}} and its text is the itemsSummary field after applying the 60-character truncation: if itemsSummary.length exceeds 60, take the first 57 characters and append the ellipsis character "…". Parameter index 3 corresponds to {{4}} and its text is totalAmount.

The truncation prevents Meta API errors caused by template variable values that exceed the character limit for the "body" component text type.

### Step 4: Implement formatPhoneNumber

Implement the formatPhoneNumber function in the same file. It accepts a raw phone number string as entered by a cashier or stored in the customer profile. The function returns an E.164-formatted phone number string with a leading "+" character.

The processing pipeline: first, strip all whitespace characters, hyphens, parentheses, and plus sign characters using a replace call with a character class regex. Second, if the cleaned numeric string starts with "0" (indicating a local Sri Lankan mobile number with the leading zero), remove the "0" and prepend "94" to apply the Sri Lanka country code. Third, if the cleaned string already starts with "94", use it as-is. Finally, prepend "+" to the cleaned string to produce the E.164 format.

Validate the final result against the regex pattern that matches a plus sign followed by 7 to 15 digits. If the result does not match, throw a TypeError with the message "Invalid phone number format: the number provided cannot be converted to a valid E.164 format." The thrown error surfaces in the route handler as a validation failure and results in a 400 response before the Meta API is called.

Export this function so it can be used for validation in the route handler and in the Receipt Preview Dialog's phone input.

### Step 5: Implement sendWhatsAppReceiptMessage

Implement and export the main sendWhatsAppReceiptMessage function. It accepts three parameters: phoneNumber (string — the raw phone number from the user), saleId (string — used in error logging for traceability), and saleData (WhatsAppReceiptPayload).

The function is declared async and returns a Promise that always resolves to an object with the shape { success: boolean; error?: string } — it never throws or rejects.

The steps inside the function: call formatPhoneNumber on the phoneNumber argument within a try-catch. If formatPhoneNumber throws, return { success: false, error: "Invalid phone number: " plus the error message } immediately. Read the three env vars WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, and WHATSAPP_TEMPLATE_NAME from process.env. If any is undefined or empty, return { success: false, error: "WhatsApp is not configured. Missing environment variables." } without attempting the API call.

Construct the Meta Cloud API request: the URL is the string "https://graph.facebook.com/v18.0/" concatenated with the WHATSAPP_PHONE_NUMBER_ID value and then "/messages". The method is POST. The headers are Content-Type application/json and Authorization Bearer plus the WHATSAPP_ACCESS_TOKEN value. The body JSON is an object with messaging_product set to "whatsapp", recipient_type set to "individual", to set to the formatted phone number, type set to "template", and template set to an object with name equal to WHATSAPP_TEMPLATE_NAME, language equal to { code: "en" }, and components equal to the array returned by formatReceiptTemplateComponents.

Wrap the fetch call in a try-catch. If fetch throws (network error), log the error to console.error with a context prefix including the saleId, and return { success: false, error: "WhatsApp dispatch failed due to a network error." }. If fetch resolves but the HTTP status is not 200 or 201, read the error body from the response as text, log it to console.error with the saleId context, and return { success: false, error: "WhatsApp dispatch failed. Meta API returned HTTP status " plus the status code. }. If the HTTP status is 200 or 201, return { success: true }.

### Step 6: Build the API Route

Create src/app/api/sales/[id]/send-receipt/route.ts. The exported POST function: validates the session, returning 401 if unauthenticated. Parses and validates the request body using a small inline Zod schema — the body must have a phoneNumber field of type string with minimum length 7 and maximum length 20 characters. Return 400 on validation failure.

Read the sale id from the route params. Call sale.service.getSaleById with the saleId and the tenantId from the session. Return 404 if the sale is not found.

Fetch the Tenant record to obtain tenantId from the session — use the tenantId to find the tenant's name and settings. Assemble the WhatsAppReceiptPayload: set storeName from the tenant name, saleReference from the first 8 characters of the sale id in uppercase, itemsSummary by joining the first three productNameSnapshot values from the SaleLines with ", " as the separator, and totalAmount formatted using the project's currency formatter.

Call sendWhatsAppReceiptMessage with the raw phoneNumber from the request body and the assembled payload. If the function returns { success: true }, update the Sale record using Prisma: set whatsappReceiptSentAt to new Date(). Return { success: true } in the standard 200 ApiResponse envelope. If the function returns { success: false }, do NOT return an HTTP error status — return 200 with the error message in the payload as { success: false, error: "..." }. This keeps the client-side handling uniform: the Receipt Preview Dialog always receives a 200 response and checks the success flag.

### Step 7: AuditLog Entry on Failure in Production

Inside the same route handler, after a failed sendWhatsAppReceiptMessage result, add a conditional block: if process.env.NODE_ENV equals "production", write an AuditLog record. The AuditLog entry should have action "WHATSAPP_DISPATCH_FAILED", entityType "SALE", entityId set to the saleId, userId from the session, and a description field noting the error string from the function result. Wrap this in a separate try-catch — if the AuditLog write itself fails, log to console.error with a message indicating the secondary failure, then continue. An AuditLog write failure must never change the HTTP response returned to the client.

## Expected Output

- src/lib/whatsapp.ts with formatPhoneNumber, formatReceiptTemplateComponents, and sendWhatsAppReceiptMessage exported.
- src/app/api/sales/[id]/send-receipt/route.ts handling the POST request.
- .env.example updated with the three WhatsApp variables and their explanatory comments.

## Validation

- Call formatPhoneNumber("0771234567") and confirm it returns "+94771234567".
- Call formatPhoneNumber("+94771234567") and confirm it returns "+94771234567" unchanged.
- Call formatPhoneNumber("notaphone") and confirm it throws a TypeError.
- Call POST /api/sales/[id]/send-receipt with a valid sale id in a Meta developer sandbox environment and confirm a 200 response with success: true and that whatsappReceiptSentAt is set on the sale.
- Simulate a Meta API failure (e.g., use an invalid token in development) and confirm the route returns HTTP 200 with success: false in the body rather than a 5xx error.

## Notes

- The Meta Cloud API v18.0 base URL and the approved template must match exactly. A mismatch between WHATSAPP_TEMPLATE_NAME and the approved template name in Meta Business Manager results in a 400 error from the Meta API with a descriptive body — this error is logged but returned to the client as a generic dispatch failure message.
- The WHATSAPP_ACCESS_TOKEN expires if it is a temporary token from the developer console. For production use, generate a system user token with a non-expiring access policy in Meta Business Manager. Document this in team onboarding notes.
- Phone numbers are validated to E.164 format by the formatPhoneNumber function, not by the Meta API. The Meta API will accept non-E.164 numbers and silently fail in some cases — normalising before the call is more reliable.
- The dispatch integration is designed to be extended in Phase 04 when customer profiles are added. The Customer model will store a whatsappNumber field that will pre-fill the phone input in the Receipt Preview Dialog, removing the need for manual entry.
