# Task 05.02.09 — Build Billing Dashboard Page

## Metadata

| Property | Value |
|---|---|
| Task ID | 05.02.09 |
| SubPhase | 05.02 — Billing and WhatsApp Automation |
| Complexity | High |
| Depends On | 05.02.08 |
| Primary Files | src/app/dashboard/[tenantSlug]/billing/page.tsx, src/app/api/billing/cancel/route.ts, src/components/billing/SubscriptionOverviewCard.tsx, src/components/billing/InvoiceHistoryTable.tsx, src/components/billing/CancelSubscriptionButton.tsx |
| Roles Involved | OWNER |

## Objective

Build the comprehensive tenant billing dashboard, consolidating current plan details, invoice history, checkout CTAs, trial information, and subscription cancellation into a single cohesive Owner-facing page. All subscription status variants (TRIAL, ACTIVE, PAST_DUE, SUSPENDED, CANCELLED) render an appropriate and functional UI.

## Instructions

### Step 1: Define the Page Layout Structure

Establish src/app/dashboard/[tenantSlug]/billing/page.tsx as a server component. Authenticate the session and redirect non-OWNER, non-MANAGER, and non-SUPER_ADMIN sessions to the dashboard home. Note that SUSPENDED tenants can access this page — this is intentional and required by the middleware bypass established in Task 05.02.07.

Fetch the subscription using getSubscriptionForTenant including plan, the last six invoices ordered by createdAt descending, and the tenant relations. Pass this data as props to the relevant child components.

Apply a linen (#EBE3DB) page background. Use a full-width single-column layout on mobile (max-width 768px) and a two-thirds / one-third column split on desktop where the left column holds the invoice history and the right column holds the overview card and CTA controls. Use a Tailwind grid or flex layout with the lg:grid-cols-3 and col-span-2 pattern.

### Step 2: Build the Subscription Overview Card

Create src/components/billing/SubscriptionOverviewCard.tsx as a client component ("use client"). Accept the subscription and plan as props typed with the Prisma model types.

The card uses a ShadCN Card component with a pearl (#F1EDE6) background and an espresso (#3A2D28) top border of 3px. Inside the card, render:

- Plan name in Playfair Display at 20pt with espresso colour (e.g., "GROWTH Plan")
- A ShadCN Badge beside the plan name for the subscription status: use variant="default" with a green className override for ACTIVE; variant="secondary" with an amber className for TRIAL and PAST_DUE; variant="destructive" for SUSPENDED; variant="outline" with muted text for CANCELLED.
- Monthly or annual billing amount in JetBrains Mono at 16pt: "LKR 3,500.00 / month"
- Next renewal date in Inter: "Next billing date: 01 April 2025" — use date-fns's format(subscription.currentPeriodEnd, "dd MMMM yyyy"). Label this "Trial ends" for TRIAL status.
- For PAST_DUE status specifically: render a warning callout card inside the overview card with terracotta (#A48374) background and white text. Compute graceDaysLeft as GRACE_PERIOD_DAYS minus daysPastDue (floored), clamped to zero. Render: "Your payment is overdue. Access will be suspended in [graceDaysLeft] day[s] if payment is not received."
- For SUSPENDED status: render an espresso-background callout: "Your account is suspended. Renew to restore access."

### Step 3: Build the Invoice History Table

Create src/components/billing/InvoiceHistoryTable.tsx as a client component. Accept an invoices array prop typed as Invoice[]. Use TanStack Query's useQuery to fetch /api/billing/invoices if a live-refresh is needed; for Phase 05 scope the server-loaded prop is sufficient.

Render a ShadCN Table. Define the following columns: Invoice Number, Billing Period, Amount, Status, Download. Specific rendering per column:

- Invoice Number: render in JetBrains Mono font with an espresso colour, (e.g., "INV-2025-0042").
- Billing Period: formatted as "dd MMM yyyy – dd MMM yyyy" using date-fns.
- Amount: "LKR [amount]" in JetBrains Mono.
- Status: ShadCN Badge — green for PAID, amber for PENDING, red for FAILED, muted for VOIDED.
- Download: an anchor tag with href="/api/invoices/[id]/pdf" and the download HTML attribute set to "[invoiceNumber].pdf". Style the anchor as a ShadCN Button with variant="ghost" size="sm" and a Download icon from Lucide React.

Apply alternating row backgrounds: even rows get linen (#EBE3DB), odd rows get pearl (#F1EDE6). If the invoices array is empty, render a centered empty state: a muted FileText icon from Lucide React and the text "No invoices yet. Your first invoice will appear here after your first payment."

### Step 4: Build the Trial Information Card

For TRIAL status, render a prominent full-width information card above the invoice history. The card has a sand (#CBAD8D) background with an espresso border. Contents:
- Heading: "You are on a free trial" in Playfair Display
- Subheading: "Your trial ends on [trialEndsAt formatted as dd MMMM yyyy]. Subscribe before then to avoid any interruption."
- A savings callout: "Annual billing saves [X]% — [LKR annualPrice]/year vs [LKR monthlyPrice × 12]/year." Compute savings as Math.round((plan.monthlyPrice.toNumber() * 12 - plan.annualPrice.toNumber()) / (plan.monthlyPrice.toNumber() * 12) * 100).
- Two side-by-side PayHereCheckoutButton components: "Subscribe Monthly — LKR [monthlyPrice]/mo" and "Subscribe Annually — LKR [annualPrice]/yr". The annual button uses an espresso background to distinguish it as the recommended option.

### Step 5: Build the Payment Method Section

Add a section below the overview card titled "Payments". Render a ShadCN Card with linen background. Include: a ShieldCheck icon from Lucide React with a green colour, text "Payments are processed securely by PayHere. VelvetPOS does not store card details." For ACTIVE subscriptions, also render: "Last payment: [paidAt of most recent PAID invoice formatted as dd MMMM yyyy]" and "Next auto-renewal: [currentPeriodEnd formatted as dd MMMM yyyy]." For TRIAL, PAST_DUE, CANCELLED, and SUSPENDED statuses, render the PayHereCheckoutButton in this section (in addition to the status-specific card from Step 4).

### Step 6: Build the Cancel Subscription Button and Dialog

Create src/components/billing/CancelSubscriptionButton.tsx as a client component. This component renders a ShadCN Button with variant="outline" and the destructive text colour class (text-destructive), labelled "Cancel Subscription". The button is only rendered for ACTIVE and TRIAL statuses — add this conditional to the parent billing page.

On click, the component opens a ShadCN AlertDialog. The AlertDialog content shows:
- Title: "Cancel your subscription?"
- Description: "You will retain full access until [currentPeriodEnd formatted as dd MMMM yyyy]. After this date, your account will be suspended and no further charges will be made."
- Two actions: a "Keep Subscription" button that closes the dialog (ShadCN AlertDialogCancel), and a "Cancel Subscription" button (ShadCN AlertDialogAction) with the destructive variant.

On confirming cancellation, the component calls PATCH /api/billing/cancel using a TanStack Query mutation. On success, redirect to the billing page (with a success query parameter or via router.refresh()) and display a toast "Your subscription has been cancelled. Access continues until [currentPeriodEnd]."

### Step 7: Create the Cancellation API Route

Create src/app/api/billing/cancel/route.ts as a PATCH handler. Authenticate with getServerSession: confirm the user's role is OWNER, as only an Owner may cancel their subscription. Extract tenantId from the session. Fetch the active Subscription for this tenant. If the subscription status is already CANCELLED, return a 409 response.

Within a Prisma transaction: update Subscription.status to CANCELLED, set cancelledAt to new Date(), update Tenant.subscriptionStatus to CANCELLED. Return the updated Subscription in a 200 JSON response.

Do not immediately revoke access — Tenant.subscriptionStatus is set to CANCELLED but the suspension middleware only redirects SUSPENDED and CANCELLED tenants (per Task 05.02.07). The tenant remains accessible until a Super Admin manually intervenes or the cron takes action. This is intentional: a self-service cancellation is treated as CANCELLED status rather than SUSPENDED status, preserving a less alarming user experience for tenants who may wish to resubscribe.

### Step 8: Handle Return Parameter Toasts

In the billing page server component, read searchParams.status. Pass a statusMessage prop to a lightweight client component (BillingPageToast from Task 05.02.04 if already created, or a new one). Render the toast on mount: green for "success", amber for "cancelled". This covers the PayHere return_url redirect feedback loop.

## Expected Output

- /dashboard/[tenantSlug]/billing — fully rendered billing dashboard for all subscription states
- SubscriptionOverviewCard with status badge, amount, and next renewal date
- InvoiceHistoryTable with PDF download links per row
- Trial information card with dual monthly/annual PayHere checkout buttons
- CancelSubscriptionButton with AlertDialog confirmation
- PATCH /api/billing/cancel — OWNER-restricted cancellation route

## Validation

- [ ] ACTIVE subscription shows plan name, ACTIVE badge, billing amount, and next billing date
- [ ] TRIAL status shows trial end date, savings callout, and dual checkout buttons
- [ ] PAST_DUE shows grace period countdown in the overview card with terracotta warning callout
- [ ] SUSPENDED status shows espresso callout and renewal CTA
- [ ] InvoiceHistoryTable renders all invoices with correct status badges
- [ ] PDF Download link for a PAID invoice returns a binary PDF response
- [ ] Cancel button is absent for SUSPENDED and CANCELLED statuses
- [ ] CancelSubscriptionButton AlertDialog shows the correct currentPeriodEnd date
- [ ] PATCH /api/billing/cancel returns 403 for MANAGER and CASHIER roles
- [ ] PATCH /api/billing/cancel returns 409 if subscription is already CANCELLED
- [ ] After cancellation, Subscription.status is CANCELLED and cancelledAt is set

## Notes

- Subscriptions in the CANCELLED state are set by tenant Owner action. Subscriptions in SUSPENDED state are set by the cron engine due to non-payment. These are distinct states with different UX implications: CANCELLED is volitional (lighter tone), SUSPENDED is enforcement-driven (urgent tone).
- Do not expose the Subscription.payhereSubscriptionToken field to the billing page — this value is internally used for recurring charge coordination and should not be visible in any client-accessible payload.
- The billing page is deliberately accessible to SUSPENDED tenants (middleware grants access to /billing). Confirm this bypass is working before testing the suspension state rendering.
