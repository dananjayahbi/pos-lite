# Task 05.02.05 — Build PayHere IPN Webhook Handler

## Metadata

| Property | Value |
|---|---|
| Task ID | 05.02.05 |
| SubPhase | 05.02 — Billing and WhatsApp Automation |
| Complexity | Very High |
| Depends On | 05.02.04 |
| Primary Files | src/app/api/webhooks/payhere/route.ts |
| Roles Involved | System (no authenticated user) |
| Env Vars | PAYHERE_MERCHANT_ID, PAYHERE_MERCHANT_SECRET |
| Security Criticality | Maximum — this route is the sole authority for subscription activation |

## Objective

Implement POST /api/webhooks/payhere, the Instant Payment Notification (IPN) handler for all PayHere payment events. This is the most security-critical route in the entire codebase. Subscription status is updated only when a received IPN passes cryptographic signature validation. Every IPN — valid or invalid — is recorded in InvoicePaymentEvent for forensic audit.

## Context

PayHere sends IPN notifications as a server-to-server HTTP POST with a URL-encoded body (Content-Type: application/x-www-form-urlencoded). The endpoint must respond with HTTP 200 regardless of outcome — PayHere interprets any non-200 response as a delivery failure and retries up to three times with exponential backoff.

The IPN signature algorithm (from PayHere's official documentation): compute the MD5 hash of the uppercase merchant secret (call this innerHash). Then compute the MD5 hash of the concatenated string: merchant_id + order_id + payhere_amount + payhere_currency + innerHash. The resulting hex string (lowercase) must equal the md5sig field received in the IPN. Both MD5 computations produce lowercase hex using Node.js's built-in crypto module.

## Instructions

### Step 1: Set Up the Route File

Create src/app/api/webhooks/payhere/route.ts. Import the NextRequest and NextResponse types from "next/server". Import createHash from the built-in "crypto" module. Import the Prisma client. This is a pure server module — no "use client" or "use server" directives.

Export an async POST function that accepts a NextRequest argument. This is the sole export — no GET, PUT, PATCH, or DELETE handlers. The function is structured as a linear pipeline: parse, validate, audit-log, process, return.

Ensure no CSRF middleware applies to this route. In the App Router, CSRF protection is opt-in and does not apply to API routes by default. If any custom CSRF middleware was added in SubPhase 01.02, explicitly exempt /api/webhooks/ from its matcher.

### Step 2: Parse the URL-Encoded Body

Read the raw body text with: const rawBody = await request.text(). Construct a URLSearchParams object from rawBody: const params = new URLSearchParams(rawBody). Extract all required IPN fields by calling params.get() for each: merchant_id, order_id, payhere_amount, payhere_currency, status_code, status_message, method, card_holder_name, card_no, card_expiry, recurring, message_type, and md5sig.

Store md5sig in a separate constant receivedSig. Immediately log a structured object to the console containing all extracted fields, with md5sig replaced by the string "REDACTED" and card_no masked as "REDACTED" regardless of whether it is present. Never log the received md5sig or card details to any logging service.

### Step 3: Validate the IPN Signature

This step is unconditional and must execute before any database read or write.

Using the Node.js crypto module's createHash function:
- Compute innerHash by creating a MD5 hash of the PAYHERE_MERCHANT_SECRET environment variable converted to uppercase using .toUpperCase(). Call .digest("hex") to get the lowercase hex string.
- Compute expectedSig by creating a MD5 hash of the concatenated string: PAYHERE_MERCHANT_ID + order_id + payhere_amount + payhere_currency + innerHash. Call .digest("hex").
- Compare expectedSig.toLowerCase() to receivedSig.toLowerCase().

Set a boolean variable signatureValid to true if they match, false otherwise.

If signatureValid is false, log a structured warning containing the order_id, the received signature (truncated to 8 characters for log safety), and the computed expected signature (also truncated). Do not abort the function — proceed to Step 4 for audit logging. After audit logging, skip Steps 5 through 8 entirely. Return a NextResponse with status 200 and body { received: true }.

### Step 4: Record the IPN as an Immutable Audit Event

Regardless of signature validity, payment status, or any other condition, create an InvoicePaymentEvent record for every incoming IPN that reaches this handler.

First, attempt to find the Invoice by id matching order_id. Run this as a plain non-throwing query (use findUnique with a try-catch). If an invoice is found, set invoiceId to invoice.id. If not found, use null for invoiceId and include a note in rawPayload.

Create the InvoicePaymentEvent record with fields: invoiceId (may be null if not found), payhereStatusCode parsed as an integer, payhereOrderId, payhereAmount parsed as a Decimal, payhereMd5sig set to the received signature value (this is safe to store — it is only dangerous if used to authorise state changes, which is intentionally blocked for invalid signatures), signatureValid, and rawPayload set to rawBody.

Wrap this entire creation in a try-catch with a silent fallback: if audit logging fails for any reason (e.g., database unavailable), log the failure to the console but do not let the audit failure propagate to the main handler. The main handler must always return 200.

### Step 5: Locate and Validate the Invoice Record

After audit logging (and only if signatureValid is true), look up the Invoice record by id matching order_id, including the subscription and tenant relations. If no invoice is found, log an error with message "IPN received for unknown order_id: [order_id]" and return 200 with { received: true }. This condition indicates a test IPN, a replay attack, or a data corruption issue — none justify making state changes.

Check whether invoice.status is already PAID. If so, this is a duplicate IPN delivery by PayHere's retry mechanism. Log "Duplicate IPN received for already-PAID invoice [invoiceId]" and return 200 with { received: true }. Making no changes on a duplicate is correct behaviour.

### Step 6: Handle Payment Success — status_code 2

If status_code equals "2", the payment was successful. Execute the following inside a single Prisma transaction (prisma.$transaction) to ensure atomicity:

- Update the Invoice: set status to PAID, set paidAt to new Date(), set payhereOrderId to the received order_id.
- Update the Subscription: set status to ACTIVE, set currentPeriodStart to invoice.billingPeriodStart, set currentPeriodEnd to invoice.billingPeriodEnd. If the recurring field in the IPN body is present and non-empty, also set payhereSubscriptionToken to the recurring value.
- Update the Tenant: set subscriptionStatus to ACTIVE.

All three updates occur in a single transaction. If the transaction fails, Prisma rolls back all three writes and the function proceeds to log the error and still return 200. The audit event created in Step 4 will record signatureValid: true and the incoming status_code regardless of the transaction outcome, providing a forensic record for investigation.

After the transaction commits, trigger invoice PDF generation by calling generateAndEmailInvoicePdf (from Task 05.02.08) wrapped in a non-blocking try-catch. The PDF generation failure must never cause the IPN response to fail — payment confirmation is the primary responsibility of this route.

Also trigger autoGenerateNextInvoice to pre-create the next billing period's Invoice with status PENDING, giving the system a record to attach the next set of payment reminders to.

### Step 7: Handle Payment Cancellation and Failure — status_code -1 and -2

If status_code equals "-1" (cancelled by the user) or "-2" (failed due to a payment error), execute within a Prisma transaction:

- Update the Invoice: set status to FAILED.
- Update the Subscription: set status to PAST_DUE.
- Update the Tenant: set subscriptionStatus to PAST_DUE.

Log the failure: "Payment [status_code] received for invoice [invoiceId], tenant [tenantId]. Subscription moved to PAST_DUE."

### Step 8: Handle Pending Notifications — status_code 0

If status_code equals "0", PayHere is delivering a pending notification (payment authorised but not yet settled). Do not change any status fields. Log "Pending IPN received for invoice [invoiceId]" and return 200. A definitive IPN (status_code 2 or negative) will follow when settlement completes.

### Step 9: Handle Recurring Charge IPNs

If message_type equals "RECURRING" in the parsed body, this IPN corresponds to a charge triggered by PayHere's recurring billing engine rather than a user-initiated checkout. In this case, the order_id generated by PayHere will not match an existing Invoice record. The handler must:

- Generate a new invoice number using generateInvoiceNumber.
- Create a new Invoice record with PENDING status, amount set to payhere_amount, billingPeriodStart and billingPeriodEnd derived from the Subscription's currentPeriodEnd data.
- Immediately apply the success or failure logic from Steps 6 and 7 based on the status_code, using the newly created invoice.

Log "Recurring IPN processed for subscription [subscriptionId], new invoice [invoiceNumber] created."

### Step 10: Always Return HTTP 200

As the final statement of the POST handler, regardless of which code path was taken, return NextResponse.json({ received: true }, { status: 200 }). This is unconditional. Never throw an unhandled error that would cause Next.js to return a 500. Wrap the entire handler body in a top-level try-catch: on any unexpected error, log the error to the console with the rawBody for context, and still return 200.

## Expected Output

- POST /api/webhooks/payhere with full IPN parsing, signature validation, and state machine transitions
- InvoicePaymentEvent created for every incoming IPN regardless of validity
- Atomic database updates for Invoice, Subscription, and Tenant on status_code 2
- Duplicate IPN safety check on already-PAID invoices
- Recurring IPN support with on-the-fly invoice creation
- Unconditional HTTP 200 response to PayHere

## Validation

- [ ] An IPN with an incorrect md5sig returns 200, creates an InvoicePaymentEvent with signatureValid false, and makes no Invoice or Subscription changes
- [ ] An IPN with status_code 2 and valid signature sets Invoice.status to PAID, Subscription.status to ACTIVE, and Tenant.subscriptionStatus to ACTIVE
- [ ] All three database writes for a successful payment occur in a single transaction (verified by testing a forced mid-transaction error)
- [ ] A duplicate IPN for an already-PAID invoice returns 200 and makes no changes
- [ ] An IPN with status_code -1 sets Invoice.status to FAILED and Subscription.status to PAST_DUE
- [ ] An IPN with status_code 0 makes no status changes and returns 200
- [ ] Every IPN creates exactly one InvoicePaymentEvent record
- [ ] The handler's top-level try-catch ensures a 200 is returned even on unexpected exceptions
- [ ] PAYHERE_MERCHANT_SECRET is never present in any log output, response body, or error message

## Notes

- MD5 is used here solely because PayHere's documented IPN verification algorithm requires it. This is not a choice — it is a compliance requirement of the payment integration. MD5 is not used anywhere else in VelvetPOS for security-sensitive purposes.
- Storing the rawPayload in InvoicePaymentEvent enables a forensic replay capability: the exact bytes received from PayHere can be independently re-verified using the published IPN verification algorithm if a signature mismatch dispute arises.
- PayHere's sandbox IPN simulator tool in the merchant portal can be used to test all status_code values (2, 0, -1, -2) against a locally tunnelled endpoint (using a tool such as ngrok) before production deployment.
- The PAYHERE_MERCHANT_SECRET must be stored in Vercel's encrypted environment section and should never appear in any source file, log entry, or error message. Treat it with the same care as a database password.
