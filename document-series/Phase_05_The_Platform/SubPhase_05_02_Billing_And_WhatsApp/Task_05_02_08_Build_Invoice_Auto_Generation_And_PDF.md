# Task 05.02.08 — Build Invoice Auto-Generation and PDF

## Metadata

| Property | Value |
|---|---|
| Task ID | 05.02.08 |
| SubPhase | 05.02 — Billing and WhatsApp Automation |
| Complexity | High |
| Depends On | 05.02.05 |
| Primary Files | src/lib/billing/invoice.service.ts, src/components/billing/InvoicePDF.tsx, src/app/api/invoices/[id]/pdf/route.ts |
| Roles Involved | System (IPN-triggered), OWNER (PDF download) |
| Dependencies | @react-pdf/renderer, Resend |

## Objective

Automatically generate the next billing period's Invoice record after each successful payment IPN, assign unique formatted invoice numbers (INV-YYYY-NNNN), generate a branded PDF document using @react-pdf/renderer, email the PDF to the tenant Owner via Resend, and serve on-demand PDF downloads through an authenticated GET API route.

## Instructions

### Step 1: Install the PDF Library

Install the PDF generation dependency by running "pnpm add @react-pdf/renderer". Add it to dependencies rather than devDependencies since it is required at runtime. This library renders React component trees to PDF binaries in a Node.js server context and does not require a headless browser or Puppeteer.

### Step 2: Extend the Invoice Service

Create or extend src/lib/billing/invoice.service.ts. Add "server-only" as an import guard at the top of the file to prevent client-side bundling.

Export the function markInvoicePaid(invoiceId: string, paidAt: Date): this accepts an invoice ID and a payment timestamp, sets Invoice.status to PAID and Invoice.paidAt to the given timestamp, and returns the updated record. Used directly by the IPN webhook handler (Task 05.02.05) within the payment transaction.

Export the function autoGenerateNextInvoice(subscriptionId: string): this creates the next billing period's Invoice record with status PENDING. Steps:
- Load the Subscription with plan, and find the most recently PAID Invoice for the subscription ordered by paidAt descending.
- Determine the billing cycle from the subscription's plan (compare currentPeriodEnd minus currentPeriodStart to approximate monthly vs annual; alternatively store the billingCycle field on Subscription if added in SubPhase 05.01).
- Compute nextBillingPeriodStart as currentPeriodEnd plus one day. Compute nextBillingPeriodEnd using date-fns's addMonths(nextBillingPeriodStart, 1) for monthly or addYears(nextBillingPeriodStart, 1) for annual. Set dueDate to nextBillingPeriodEnd.
- Generate the invoice number inside a serialisable transaction using generateInvoiceNumber from the PayHere service module.
- Create and return the Invoice record.

Export the function generateAndEmailInvoicePdf(invoiceId: string): used post-payment to produce a PDF and deliver it by email. Detailed in Steps 4 and 5 below.

### Step 3: Build the Invoice PDF Component

Create src/components/billing/InvoicePDF.tsx. At the top of the file, add a server-only import guard. Import Document, Page, View, Text, Image, StyleSheet, and Font from @react-pdf/renderer. Do not import any browser React primitives (div, p, span, etc.) — @react-pdf/renderer uses its own layout primitive set.

Register the fonts using Font.register: add Playfair Display for headings using a Google Fonts CDN URL (or a local file path relative to the project root), Inter for body text, and JetBrains Mono for monetary values and reference codes.

Define a styles object using StyleSheet.create with the following style groups:
- page: background colour linen (#EBE3DB), padding 40pt
- header: background colour sand (#CBAD8D), padding 20pt, flexDirection row, borderBottom with espresso (#3A2D28) colour
- logo: width 60pt, height 60pt, marginRight 12pt
- companyName: fontFamily Playfair Display, fontSize 20pt, colour espresso (#3A2D28)
- sectionLabel: fontFamily Inter, fontSize 8pt, colour mist (#D1C7BD), textTransform uppercase, marginBottom 4pt
- sectionValue: fontFamily Inter, fontSize 10pt, colour espresso (#3A2D28)
- tableHeader: backgroundColor espresso, colour pearl (#F1EDE6), fontFamily Inter, fontSize 9pt, fontWeight bold
- tableRowEven: backgroundColor linen (#EBE3DB), fontFamily Inter, fontSize 9pt
- tableRowOdd: backgroundColor pearl (#F1EDE6), fontFamily Inter, fontSize 9pt
- mono: fontFamily JetBrains Mono, fontSize 10pt
- statusBadgePaid: backgroundColor "green" (dark), colour white
- statusBadgePending: backgroundColor sand (#CBAD8D), colour espresso

Define a React functional component InvoicePDF that accepts a props object containing invoice (Invoice with tenant, subscription, and plan relations). The component renders a Document containing a single Page. Structure the page content as follows:

- Header band: company logo (VelvetPOS wordmark as a base64-encoded PNG stored in src/lib/billing/assets/logo-base64.ts to avoid any path resolution issues in the Node.js PDF renderer context), company name "VelvetPOS", tagline "Boutique POS for Sri Lanka", and support email.
- Bill To section: "Bill To" label, tenant business name, tenant address, Owner email.
- Invoice Metadata table (two-column): Invoice Number (mono font), Invoice Date, Due Date, Billing Period (start to end formatted as "dd/MM/yyyy – dd/MM/yyyy").
- Line Items table: a header row with columns Description, Qty, Unit Price, Total. One data row: "VelvetPOS [planName] Plan — [cycle] Subscription", "1", "LKR [amount]", "LKR [amount]". Both amounts in JetBrains Mono.
- Totals section: Sub-Total, Tax (0%), Total Amount Due (bold, larger font). Payment Status shown as a coloured badge: "PAID" on green or "PENDING" on sand.
- Footer: "Thank you for your business. Please retain this invoice for your records." centred, mist colour, small font.

### Step 4: Implement the PDF Generation and Email Delivery Function

In invoice.service.ts, implement generateAndEmailInvoicePdf(invoiceId: string). This function:
- Fetches the Invoice record with all necessary relations (tenant with owner user, subscription with plan).
- Calls renderToBuffer from @react-pdf/renderer, passing the InvoicePDF React element with the fully hydrated props object. This is an async call that returns a Node.js Buffer of the PDF binary.
- Constructs a Resend email: subject "Your VelvetPOS Invoice [invoiceNumber]", to the tenant Owner's email, a text body line "Please find your invoice for [billingPeriod] attached.", and an attachment object with filename "[invoiceNumber].pdf" and content set to the PDF buffer encoded as base64 (buffer.toString("base64")).
- Sends the email using the Resend client. On success, log "Invoice PDF emailed: [invoiceNumber] to [ownerEmail]".
- Optionally updates Invoice.pdfUrl if a Vercel Blob or S3 upload URL is available. For Phase 05 scope without blob storage, skip the URL update and email only.
- Returns void. Any error is logged but not propagated — PDF delivery is secondary to payment confirmation.

### Step 5: Build the PDF Download API Route

Create src/app/api/invoices/[id]/pdf/route.ts as a GET handler. Authentication: resolve the session and confirm the requesting user belongs to the tenant that owns the invoice. Acceptable roles: OWNER, MANAGER, SUPER_ADMIN. A CASHIER or STOCK_CLERK requesting an invoice PDF receives a 403. The tenantId in the invoice must match the tenantId in the session for non-SUPER_ADMIN roles.

Fetch the Invoice by id (from the route params) with the tenant and subscription relations. If not found, return a 404 JSON response.

If invoice.pdfUrl is a non-null string, redirect to that URL with a 302 response. This serves pre-generated PDFs from blob storage without re-generating them.

If invoice.pdfUrl is null (the common Phase 05 path), generate on the fly: call renderToBuffer with the InvoicePDF component, set the Content-Type header to "application/pdf", set Content-Disposition to inline; filename="[invoiceNumber].pdf", and return a new NextResponse with the buffer as the body. The NextResponse constructor accepts a Buffer or Uint8Array as the body argument.

### Step 6: Hook PDF Generation into the IPN Handler

In src/app/api/webhooks/payhere/route.ts, after the successful payment transaction commits (Step 6 in Task 05.02.05), add a non-blocking call: wrap generateAndEmailInvoicePdf(paidInvoice.id) in a Promise that does not await the response from the main handler. Immediately follow with a non-blocking autoGenerateNextInvoice(subscription.id) call. Both calls are wrapped in their own try-catch blocks. Catching their errors must not interfere with the return of HTTP 200 to PayHere.

## Expected Output

- src/lib/billing/invoice.service.ts with markInvoicePaid, autoGenerateNextInvoice, generateAndEmailInvoicePdf
- src/components/billing/InvoicePDF.tsx — branded PDF template with Playfair Display, Inter, and JetBrains Mono fonts
- GET /api/invoices/[id]/pdf — authenticated PDF download route
- PDF emailed to tenant Owner via Resend on every successful IPN
- Next-period Invoice automatically created after each successful payment

## Validation

- [ ] pnpm add @react-pdf/renderer installs without peer dependency conflicts
- [ ] InvoicePDF renders to a valid PDF binary using renderToBuffer in a test script
- [ ] Generated PDF contains: VelvetPOS header, tenant bill-to section, invoice metadata, line items table, totals, and footer
- [ ] Invoice number in the PDF matches the INV-YYYY-NNNN format
- [ ] GET /api/invoices/[id]/pdf returns a binary response with Content-Type application/pdf
- [ ] A CASHIER requesting another tenant's invoice PDF receives 403
- [ ] An OWNER requesting their own invoice PDF receives the binary without redirect
- [ ] Resend email is dispatched with the PDF attachment after a successful IPN
- [ ] autoGenerateNextInvoice creates a new PENDING Invoice with the correct next billing period dates
- [ ] PDF generation failure in the IPN handler does not prevent the 200 response to PayHere

## Notes

- @react-pdf/renderer must only be imported in server-side files. Mark any file importing it with "server-only" or place it under a /server/ path convention. Importing it in a client component will cause a build-time bundle error because it uses Node.js-specific modules not available in the browser runtime.
- The VelvetPOS logo for the PDF should be embedded as a base64-encoded data URI string stored in a dedicated server-only constants file. Using a relative file path risks resolution failures in deployed serverless environments where the working directory may differ from the project root.
- If Vercel Blob storage becomes available in a later SubPhase, the pdfUrl field can be populated after upload and the on-the-fly generation in the PDF route replaced with a simple redirect to the CDN URL.
