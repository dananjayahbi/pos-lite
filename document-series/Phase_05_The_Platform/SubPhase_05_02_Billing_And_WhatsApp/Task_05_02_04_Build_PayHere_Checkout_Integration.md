# Task 05.02.04 — Build PayHere Checkout Integration

## Metadata

| Property | Value |
|---|---|
| Task ID | 05.02.04 |
| SubPhase | 05.02 — Billing and WhatsApp Automation |
| Complexity | High |
| Depends On | 05.02.01, 05.02.03 |
| Primary Files | src/lib/billing/payhere.service.ts, src/app/dashboard/[tenantSlug]/billing/actions.ts, src/components/billing/PayHereCheckoutButton.tsx, src/app/dashboard/[tenantSlug]/billing/page.tsx |
| Roles Involved | OWNER |
| Env Vars | PAYHERE_MERCHANT_ID, PAYHERE_MERCHANT_SECRET, PAYHERE_SANDBOX |

## Objective

Enable tenant Owners to initiate a subscription payment through PayHere's hosted payment page. The server constructs all required form fields, pre-creates a PENDING Invoice record linked to the checkout session, and the client component submits the form to PayHere. The IPN webhook (Task 05.02.05) handles the authoritative payment outcome. Support both PayHere sandbox and production environments via the PAYHERE_SANDBOX flag.

## Context

PayHere's hosted checkout flow requires the merchant to POST a set of fields to PayHere's payment URL. The browser navigates to PayHere's secure payment page where the customer enters card details. PayHere then sends an IPN to the notify_url and redirects the user back to the return_url or cancel_url. Only the IPN is authoritative — the return_url redirect is purely cosmetic for user experience.

The order_id field sent to PayHere must map to a record in the VelvetPOS database so the IPN handler can find and update it. In VelvetPOS, the order_id equals the Invoice.id, meaning a PENDING Invoice must exist before the user is redirected to PayHere. This design ensures every payment attempt is traceable even if the user closes the browser after the redirect.

## Instructions

### Step 1: Create the PayHere Service Module

Create src/lib/billing/payhere.service.ts. This is a server-only module — add import "server-only" at the top to prevent accidental bundling into client code.

Define and export the constant PAYHERE_PAYMENT_URL. Resolve it at runtime: if PAYHERE_SANDBOX equals the string "true", set the value to "https://sandbox.payhere.lk/pay/checkout". Otherwise set it to "https://www.payhere.lk/pay/checkout". Export this alongside a PAYHERE_RECURRING_URL constant for the recurring charge API endpoint (https://www.payhere.lk/merchant/v1/recurring/charge and its sandbox counterpart), even though recurring charges are not triggered in Phase 05 scope.

Export the function buildPayhereCheckoutPayload that accepts four arguments: invoice (fully loaded Invoice record), subscription (Subscription with its plan), tenant (Tenant), and ownerUser (User). The function returns a Record of string keys to string values. The returned object must include all fields that PayHere requires:

- merchant_id set to PAYHERE_MERCHANT_ID
- return_url set to the tenant's billing page URL with the query parameter status=success appended (e.g., https://[tenantSlug].velvetpos.com/dashboard/billing?status=success)
- cancel_url set to the same billing page URL but with status=cancelled
- notify_url set to process.env.NEXTAUTH_URL concatenated with "/api/webhooks/payhere"
- order_id set to invoice.id — this is the critical mapping field
- items set to a human-readable description of the plan (e.g., "VelvetPOS GROWTH Plan — Monthly Subscription")
- currency set to "LKR"
- amount set to invoice.amount formatted to exactly two decimal places as a string (e.g., "3500.00") — use Decimal.js's toFixed(2) to avoid floating-point artifacts
- first_name and last_name derived from ownerUser.name split at the first space
- email set to ownerUser.email
- phone set to tenant.phone
- address set to tenant.address or a placeholder if null
- city set to tenant.city or "Colombo" as default
- country set to "Sri Lanka"
- custom_1 set to tenant.id for forensic correlation
- custom_2 set to subscription.id

Export the function generateInvoiceNumber. This function runs inside a Prisma transaction with a serializable isolation level to prevent race conditions under concurrent invoice creation. It counts the number of existing invoices for the current calendar year (where createdAt year equals the current year). It then returns the formatted string "INV-" + currentYear + "-" + (count + 1) padded to four digits with leading zeros (e.g., "INV-2025-0042"). Execute this count inside the same transaction that creates the Invoice record to avoid gaps or duplicates.

### Step 2: Create the Checkout Server Action

Create src/app/dashboard/[tenantSlug]/billing/actions.ts with the "use server" directive at the top. Export the async server action initiateCheckout which accepts tenantSlug (String), planId (String), and billingCycle (String: "monthly" or "annual") as arguments.

The action performs the following steps in sequence:
- Authenticate the caller using getServerSession. Confirm the session user's role is OWNER and their tenantId matches the tenant identified by tenantSlug. Return an error object if any check fails.
- Load the SubscriptionPlan by planId and confirm isActive is true.
- Determine the charge amount: use plan.monthlyPrice for "monthly" cycle and plan.annualPrice for "annual".
- Compute date fields: billingPeriodStart is today, billingPeriodEnd is today plus one month (for monthly) or today plus one year (for annual) using date-fns's addMonths or addYears, dueDate is today plus 7 days.
- Inside a Prisma transaction, generate the invoice number and create the Invoice record with status PENDING.
- Load the tenant Owner user and the Tenant record.
- Call buildPayhereCheckoutPayload with the created invoice, subscription, tenant, and Owner.
- Return an object containing: invoiceId, payhereUrl (the PAYHERE_PAYMENT_URL constant), and payload (the checkout form fields object).

### Step 3: Build the PayHere Checkout Client Component

Create src/components/billing/PayHereCheckoutButton.tsx as a client component ("use client"). It accepts props: tenantSlug, planId, billingCycle, and buttonLabel (String).

Declare a loading state using the useTransition hook. The button's onClick handler calls initiateCheckout via the server action import. While the transition is pending, replace the button label with a spinning Loader2 icon from Lucide React and disable the button to prevent double submissions.

When the server action resolves successfully, construct a temporary form element programmatically: set method to "post" and action to the returned payhereUrl. Iterate over the payload object and append one hidden input element per key-value pair. Append the form to document.body and call form.submit(). After calling submit, remove the form element from document.body (cleanup for the rare case where the browser stays on the same tab). The browser navigation to PayHere's payment page takes over immediately after submit.

If the server action returns an error or throws, display a ShadCN toast notification with the destructive variant, showing the error message. Remove the loading state.

### Step 4: Build the Initial Billing Page Structure

Create src/app/dashboard/[tenantSlug]/billing/page.tsx as a server component. Validate the session: redirect roles other than OWNER, MANAGER, and SUPER_ADMIN to the dashboard home. Load the subscription using getSubscriptionForTenant, then render different section states based on subscription.status:

- TRIAL: render a featured trial card with the plan name, days remaining, and two PayHereCheckoutButton instances — one for monthly billing (label "Subscribe Monthly — LKR [monthlyPrice]/mo") and one for annual billing (label "Subscribe Annually — LKR [annualPrice]/yr, Save [X]%"). Compute the savings percentage as Math.round((monthlyPrice * 12 - annualPrice) / (monthlyPrice * 12) * 100).
- PAST_DUE: render an overdue warning banner in terracotta with a single PayHereCheckoutButton to reinstate the subscription.
- ACTIVE: render the SubscriptionOverviewCard and InvoiceHistoryTable components (built fully in Task 05.02.09).
- SUSPENDED: render the full billing page (accessible via the middleware bypass) with a prominent renewal CTA.
- CANCELLED: render a reactivation card with a PayHereCheckoutButton.

The billing page is the only access point for payment initiation, so all billing states must render a functional UI.

### Step 5: Handle Return and Cancel URL Parameters

At the top of the billing page server component, read the searchParams.status query parameter. Pass a successMessage or cancelMessage string prop to a toast client wrapper. Create a small client component (src/components/billing/BillingPageToast.tsx) that accepts an optional message and an optional type ("success" | "cancel"), and calls useToast on mount if the message prop is non-null. Render this component at the top of the billing page.

Display a green toast for status=success: "Payment received — your subscription is being activated." Display an amber toast for status=cancelled: "Payment was cancelled. No changes have been made to your plan."

Include a clear comment in both the action and the billing page emphasising that the return URL is for UX only. Subscription status is never updated based on a return URL redirect — only the IPN webhook updates billing state.

### Step 6: Document Portal Configuration Requirements

Add a note in the codebase at src/lib/billing/payhere.service.ts (as an inline comment block, not a code block) listing the PayHere merchant portal configuration steps required before going live:
- Whitelist the production notify_url domain in the PayHere merchant portal under Allowed Domains.
- Set the Recurring IPN URL in the portal to the same /api/webhooks/payhere endpoint.
- Test with at least one sandbox payment using PayHere's test card numbers before switching PAYHERE_SANDBOX to false.
- Store PAYHERE_MERCHANT_SECRET in Vercel's encrypted environment variables section, never in .env committed to source control.

## Expected Output

- src/lib/billing/payhere.service.ts — buildPayhereCheckoutPayload, generateInvoiceNumber, PAYHERE_PAYMENT_URL
- src/app/dashboard/[tenantSlug]/billing/actions.ts — initiateCheckout server action creating a PENDING Invoice
- src/components/billing/PayHereCheckoutButton.tsx — programmatic form POST client component
- /dashboard/[tenantSlug]/billing page — conditional section rendering for all subscription statuses

## Validation

- [ ] initiateCheckout creates a PENDING Invoice record in the database before returning any payload
- [ ] The amount field in the payload is formatted to exactly two decimal places (e.g., "3500.00")
- [ ] PAYHERE_SANDBOX=true routes the form action to sandbox.payhere.lk
- [ ] PAYHERE_SANDBOX=false routes the form action to www.payhere.lk
- [ ] The order_id payload field equals the Invoice.id of the newly created PENDING Invoice
- [ ] notify_url resolves to NEXTAUTH_URL + "/api/webhooks/payhere"
- [ ] The checkout button shows Loader2 spinner while initiateCheckout is pending
- [ ] Duplicate submissions are prevented while the transition is active
- [ ] return_url and cancel_url include the correct tenantSlug
- [ ] status=success query parameter triggers the success toast
- [ ] Calling initiateCheckout from a session belonging to a different tenant fails with an error

## Notes

- The PAYHERE_MERCHANT_SECRET must never appear in the payload sent to the client or in any client component prop. It is used exclusively server-side for IPN signature validation in Task 05.02.05.
- PayHere's hosted payment page is PCI-compliant. VelvetPOS does not handle, transmit, or store card numbers — PayHere's page handles all card interactions.
- Each PayHere checkout session creates a unique Invoice with a unique order_id. If a customer abandons the PayHere page and returns to initiate checkout again, a second PENDING Invoice is created. The cron job should periodically mark orphaned PENDING invoices (older than 30 days) as VOIDED during a future maintenance pass.
