# SubPhase 05.02 — Billing and WhatsApp Automation

## Metadata

| Property | Value |
|---|---|
| SubPhase ID | 05.02 |
| Name | Billing and WhatsApp Automation |
| Phase | 05 — The Platform |
| Status | Planned |
| Depends On | SubPhase 05.01 (SaaS Infrastructure), SubPhase 03.02 (WhatsApp Cloud API utilities) |
| Estimated Complexity | Very High |
| Primary Roles | SUPER_ADMIN, OWNER |

## Objective

Implement the complete billing lifecycle for VelvetPOS tenants, including PayHere-powered subscription payments, invoice generation and PDF delivery, grace period enforcement, tenant suspension and recovery, and automated WhatsApp payment reminders. By the end of this SubPhase, every tenant will be enrolled in a subscription tier, billed monthly or annually via PayHere's Recurring Charge API, and business managers will have full MRR visibility in the Super Admin dashboard.

## Scope

### In Scope

- Prisma data models: SubscriptionPlan, Subscription, Invoice, PaymentReminder, InvoicePaymentEvent
- Super Admin subscription plan management UI (CRUD for STARTER, GROWTH, ENTERPRISE)
- Automatic 30-day trial subscription on new tenant creation
- PayHere Checkout form construction and server-side submission flow
- PayHere IPN webhook with cryptographic MD5 signature validation (security-critical)
- Grace period logic (7 days post-due) and Vercel Cron-driven suspension
- Suspension middleware redirecting blocked routes to a branded notice page
- Invoice PDF generation using @react-pdf/renderer and email delivery via Resend
- Billing dashboard for tenant Owners: plan details, history, cancellation
- WhatsApp automated payment reminders (3-day, due-date, overdue) via Meta Cloud API
- MRR / ARR / Churn metrics dashboard for Super Admin with Recharts PieChart
- Seed data for STARTER, GROWTH, ENTERPRISE plans and multi-status demo tenants

### Out of Scope

- Credit card on-file storage (PayHere handles all payment data on their hosted page)
- Proration calculations for mid-cycle plan upgrades
- Refund flows (handled manually via the PayHere merchant portal)
- MRR growth trending (deferred to Phase 06 — requires daily MRR snapshot data)
- Email-only reminder channel (Phase 05 scope defaults to WhatsApp primary)

## Technical Context

VelvetPOS uses PayHere as its payment gateway — Sri Lanka's leading online payment provider. Subscriptions are initiated by redirecting tenants to PayHere's hosted payment page via a server-constructed hidden HTML form POST. PayHere notifies the system of all payment outcomes via an Instant Payment Notification (IPN), a server-to-server POST request with a URL-encoded body sent to a configured webhook endpoint.

**IPN Signature Validation** is mandatory for every incoming IPN. The expected signature is computed as the MD5 hash of a concatenated string comprising the merchant ID, order ID, PayHere amount, currency, and the MD5 of the uppercase merchant secret. Any IPN that does not produce a matching signature must be silently discarded while still returning HTTP 200 to PayHere, as PayHere expects 200 regardless of outcome and will retry on any other status.

The Tenant model carries a denormalized subscriptionStatus field that mirrors Subscription.status. This field enables Next.js middleware access checks without an extra database join on every request. It is kept in sync by all billing service functions using atomic Prisma transactions.

Vercel Cron Jobs are used for two scheduled tasks: the nightly subscription lifecycle check (midnight UTC) and the daily payment reminder dispatch (9 AM UTC). Both routes are protected by a shared CRON_SECRET Bearer token using timing-safe comparison.

WhatsApp messages reuse the Meta Cloud API utility established in SubPhase 03.02. Resend is used for transactional emails (suspension notifications and invoice delivery).

## Task List

| Task ID | Task Name | Complexity | Dependencies |
|---|---|---|---|
| 05.02.01 | Create Billing Models | High | SubPhase 05.01 |
| 05.02.02 | Build Subscription Plan Management (Super Admin) | Medium | 05.02.01 |
| 05.02.03 | Build Tenant Signup and Trial Flow | Medium | 05.02.01, 05.02.02 |
| 05.02.04 | Build PayHere Checkout Integration | High | 05.02.01, 05.02.03 |
| 05.02.05 | Build PayHere IPN Webhook Handler | Very High | 05.02.04 |
| 05.02.06 | Build Grace Period and Suspension Engine | High | 05.02.05 |
| 05.02.07 | Build Suspension Middleware and Notice Page | Medium | 05.02.06 |
| 05.02.08 | Build Invoice Auto-Generation and PDF | High | 05.02.05 |
| 05.02.09 | Build Billing Dashboard Page | High | 05.02.08 |
| 05.02.10 | Build WhatsApp Payment Reminders | Medium | 05.02.06, SubPhase 03.02 |
| 05.02.11 | Build MRR Dashboard (Super Admin) | High | 05.02.05 |
| 05.02.12 | Seed Demo Billing Data | Medium | 05.02.01 |

## Validation Criteria

- [ ] All five Prisma billing models exist and the migration runs clean
- [ ] Super Admin can create, edit, and deactivate subscription plans without affecting existing subscriptions
- [ ] New tenant creation automatically creates a 30-day TRIAL subscription record
- [ ] Trial countdown banner renders correctly in the dashboard header, shifting from sand to terracotta within 7 days
- [ ] PayHere checkout form constructs with all required fields and submits to the correct endpoint (sandbox or live)
- [ ] IPN webhook rejects any request with an invalid md5sig: logs only, returns HTTP 200, makes no database changes
- [ ] IPN with status_code 2 transitions Invoice to PAID, Subscription to ACTIVE, Tenant.subscriptionStatus to ACTIVE atomically
- [ ] Daily cron transitions TRIAL subscriptions past their trial end to PAST_DUE
- [ ] Daily cron transitions PAST_DUE subscriptions beyond the 7-day grace period to SUSPENDED
- [ ] Suspension middleware redirects /pos/ and /dashboard/ routes (except /billing) for SUSPENDED tenants
- [ ] Invoices are auto-generated on successful payment with correct INV-YYYY-NNNN numbering
- [ ] Invoice PDFs are generated by @react-pdf/renderer and emailed via Resend
- [ ] Billing dashboard surfaces plan details, invoice history, and functional CTA controls for all subscription statuses
- [ ] WhatsApp reminders dispatch for 3-day, due-date, and overdue intervals without duplicates
- [ ] MRR dashboard displays correct aggregate MRR, ARR, subscriber counts, and churn metrics
- [ ] Seed script populates three plans and at least three tenants with varied subscription statuses

## Files Created or Modified

- prisma/schema.prisma — SubscriptionPlan, Subscription, Invoice, InvoicePaymentEvent, PaymentReminder models; Tenant.subscriptionStatus field
- prisma/migrations/ — add_billing_models migration
- src/lib/billing/subscription.service.ts — createTrialSubscription, getSubscriptionForTenant
- src/lib/billing/invoice.service.ts — autoGenerateNextInvoice, markInvoicePaid, generateAndEmailInvoicePdf
- src/lib/billing/payhere.service.ts — buildPayhereCheckoutPayload, generateInvoiceNumber, PAYHERE_PAYMENT_URL
- src/components/billing/InvoicePDF.tsx — @react-pdf/renderer branded invoice template
- src/components/billing/PayHereCheckoutButton.tsx — form-posting checkout client component
- src/components/billing/SubscriptionOverviewCard.tsx
- src/components/billing/InvoiceHistoryTable.tsx
- src/components/billing/CancelSubscriptionButton.tsx
- src/components/layout/TrialBanner.tsx
- src/components/super-admin/MetricsCharts.tsx — Recharts PieChart
- src/app/dashboard/super-admin/plans/page.tsx
- src/app/dashboard/super-admin/metrics/page.tsx
- src/app/dashboard/[tenantSlug]/billing/page.tsx
- src/app/dashboard/[tenantSlug]/billing/actions.ts — initiateCheckout server action
- src/app/dashboard/[tenantSlug]/suspended/page.tsx
- src/app/api/admin/plans/route.ts
- src/app/api/admin/plans/[id]/route.ts
- src/app/api/admin/metrics/route.ts
- src/app/api/billing/cancel/route.ts
- src/app/api/webhooks/payhere/route.ts
- src/app/api/cron/check-subscriptions/route.ts
- src/app/api/cron/payment-reminders/route.ts
- src/app/api/invoices/[id]/pdf/route.ts
- src/middleware.ts — subscription status check added
- prisma/seed.ts — billing seed data appended
- next.config.ts — cron job declarations added
- vercel.json — cron entries added
- .env.example — PAYHERE_MERCHANT_ID, PAYHERE_MERCHANT_SECRET, PAYHERE_SANDBOX, RESEND_API_KEY, CRON_SECRET
