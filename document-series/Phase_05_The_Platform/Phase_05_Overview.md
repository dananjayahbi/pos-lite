# Phase 05 — The Platform

## Metadata

| Attribute            | Details                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------- |
| **Phase Number**     | 05                                                                                              |
| **Codename**         | The Platform                                                                                    |
| **Status**           | Not Started                                                                                     |
| **Dependencies**     | Phase 04 — The Operations (complete)                                                            |
| **Estimated Effort** | Largest phase — approximately 36–40 task documents across 3 sub-phases                         |
| **Primary Goal**     | Complete the analytics and reporting suite, activate full SaaS billing, finalize WhatsApp automation, and ship a production-ready deployment |

---

## Objective

Phase 05 transforms VelvetPOS from a feature-complete POS application into a fully production-deployable SaaS platform. This phase delivers the analytics layer that gives boutique owners real business intelligence — profit and loss reports, sales trends, staff performance, inventory valuation, and customer lifetime value metrics. It activates the billing lifecycle that allows the product to generate revenue: PayHere recurring subscriptions, automated invoicing, payment reminders, and the grace/suspension engine. Finally, it hardens the system for production: Vercel deployment with custom subdomains, Sentry error monitoring, final accessibility and UI polish, and a comprehensive seeder that creates enough demo data for sales demos.

By the end of Phase 05, the application is deployable to `storename.velvetpos.com`, subscriptions self-manage, and an owner can open the reporting dashboard and make data-driven decisions without leaving the application.

---

## Sub-Phase Breakdown

| Sub-Phase | Name                              | Scope Summary                                                          |
| --------- | --------------------------------- | ---------------------------------------------------------------------- |
| **05.01** | Reporting and Analytics           | 18+ report types, chart visualisations, date-range filtering, PDF/CSV/Excel export, automated daily email summary |
| **05.02** | Billing and WhatsApp Automation   | PayHere recurring subscriptions, IPN webhook, automated invoicing, payment reminders, grace period and suspension engine, MRR dashboard for Super Admin |
| **05.03** | Production Deployment and Polish  | Vercel deployment, custom subdomain configuration, Sentry error logging, API webhook events, system status page, final UI polish and accessibility pass, comprehensive demo seeder |

---

## Key Deliverables

### Reporting and Analytics (05.01)

- **Financial Reports**: Profit and loss by date range, revenue by payment method, daily/weekly/monthly revenue trends with Recharts line/bar charts
- **Sales Reports**: Sales by product, by category, by staff, by customer, by hour-of-day heatmap
- **Inventory Reports**: Current stock valuation (current cost price × quantity), low-stock alert list, dead stock report (no sales in 90 days), stock movement history with charts
- **Staff Reports**: Commission earned per period, hours worked per staff member (from TimeClock), top performers by revenue and transaction count
- **Customer Reports**: Customer lifetime value ranking, new vs. returning customers by period, customer spend distribution, churn risk (customers with no purchase in 90+ days)
- **Returns Reports**: Return rate by product category, returns by reason, net revenue impact
- **Export**: Every report exports as PDF (using react-pdf or jsPDF), CSV (PapaParse serialize), and Excel (using xlsx library)
- **Scheduled Summary**: Daily email digest to tenant Owner summarizing yesterday's sales, top product, and cash balance — delivered via Resend email API

### Billing and WhatsApp Automation (05.02)

- **PayHere Integration**: Recurring subscription plans stored in a SubscriptionPlan model; Subscription model tracks current plan, billing cycle, next billing date, status (ACTIVE, PAST_DUE, SUSPENDED, CANCELLED); PayHere recurring charge API used for auto-renewals
- **IPN Webhook**: POST /api/webhooks/payhere handles PayHere Instant Payment Notification — validates MD5 hash signature, updates Subscription.status on success/failure
- **Invoicing**: Invoice model auto-generated each billing cycle; sent via email (Resend); also downloadable from dashboard
- **Payment Reminders**: WhatsApp message to Owner.phone 3 days before due date and on the due date if unpaid, sent via Vercel Cron Job (cron: "0 9 * * *")
- **Grace Period**: 7-day grace period after failed payment — POS still operable. After grace period, Tenant.status set to SUSPENDED and all POS routes redirect to a suspension notice page
- **Suspension Engine**: Cron job daily checks overdue subscriptions past grace period and suspends tenants
- **MRR Dashboard**: Super Admin only — shows Monthly Recurring Revenue, Active/Suspended/Cancelled tenant counts, revenue by plan tier, churn rate

### Production Deployment and Polish (05.03)

- **Vercel Deployment**: Full production deployment configuration — environment variables, edge runtime where appropriate, Image Optimization configuration
- **Custom Subdomains**: `[tenantSlug].velvetpos.com` via Vercel's Domains API — each tenant gets a subdomain on signup. Wildcard CNAME configuration documented
- **Sentry**: Error logging for both client and server. All unhandled errors captured. Source maps uploaded. Custom context tags for tenantId
- **Webhook Events**: Outbound webhook system — tenants can register a webhook URL and receive POST notifications for `sale.completed`, `stock.low`, `return.completed` events. WebhookEndpoint model, HMAC-SHA256 signature on payload
- **System Status Page**: Public-facing `/status` page showing current system health (API latency, database connectivity, last deployment time)
- **UI Polish**: Responsive layout audit for all pages (tablet and desktop — not mobile-first); keyboard navigation improvements; loading skeleton states for all data fetches; empty state illustrations for all list views; error boundary components for graceful error display
- **Accessibility**: WCAG 2.1 AA compliance pass — focus rings, ARIA labels on all icon-only buttons, color contrast audit, `sr-only` labels
- **Demo Seeder**: Comprehensive seed script generating 90 days of realistic sales history for a demo boutique — useful for sales demos and report population

---

## New Models Introduced in Phase 05

| Model               | Purpose                                                                              |
| ------------------- | ------------------------------------------------------------------------------------ |
| SubscriptionPlan    | Defines available billing tiers (STARTER, GROWTH, ENTERPRISE) with price and limits |
| Subscription        | One per tenant, tracks current plan, status, next billing date                      |
| Invoice             | Auto-generated billing document per cycle, with line items and payment details      |
| WebhookEndpoint     | Tenant-registered URL for outbound webhook events                                   |
| WebhookDelivery     | Log of each webhook send attempt (for debugging and retry UI)                       |
| SavedReport         | User-saved report configuration (filters, date range, report type, name)            |

---

## Technical Architecture Notes

### Reporting Architecture

Reports are built as server-side computed aggregations via Prisma queries. Heavy aggregate queries (e.g., P&L over 90 days) use raw SQL via `prisma.$queryRaw` with parameterized inputs to avoid N+1 issues. Results are cached in TanStack Query with a short stale time (30 seconds for dashboard summaries, 5 minutes for full reports). Charts use the Recharts library (`pnpm add recharts`). PDF export uses `@react-pdf/renderer` for structured PDFs or `jspdf` + `html2canvas` for screenshot-based export. Excel export uses the `xlsx` library (`pnpm add xlsx`). CSV uses PapaParse serialize.

### PayHere Integration

PayHere is the Sri Lankan payment gateway. Recurring subscriptions use PayHere's Recurring Charge API. The IPN webhook handler validates the payment notification by recomputing the MD5 hash using the merchant secret and comparing it to the received hash. This is a critical security step — no subscription status must be updated without a valid IPN hash. PayHere sandbox credentials are used during development; production credentials are stored as Vercel environment variables `PAYHERE_MERCHANT_ID` and `PAYHERE_MERCHANT_SECRET`.

### Subdomain Routing

Each tenant's storefront lives at `[tenantSlug].velvetpos.com`. Middleware in `src/middleware.ts` reads the hostname, extracts the slug, queries the Tenant record, and attaches it to the request. For local development, the middleware accepts a `X-Tenant-Slug` header override. The root domain `velvetpos.com` serves the marketing landing page and signup flow.

### Sentry Configuration

`@sentry/nextjs` is initialised with the DSN stored in `NEXT_PUBLIC_SENTRY_DSN`. Server-side Sentry configuration is in `sentry.server.config.ts`; client-side in `sentry.client.config.ts`. Custom Sentry breadcrumbs are added in the auth flow and sale completion flow. `SENTRY_AUTH_TOKEN` is required for source map upload during Vercel deploys.

### Outbound Webhooks

Each registered WebhookEndpoint receives a POST with a JSON payload signed using HMAC-SHA256 with the tenant's webhook secret (a 32-byte random secret generated at endpoint creation, shown once to the user). Recipients verify the `X-VelvetPOS-Signature` header. Delivery is attempted once synchronously (fire-and-forget within 2 seconds); failures are logged to WebhookDelivery.status = FAILED and the endpoint can be retried from the dashboard.

---

## Sub-Phase Dependencies

```
SubPhase_05_01_Reporting_And_Analytics
  └── Requires: Phase 04 complete (CRM, Suppliers, Staff, Promotions, Expenses)

SubPhase_05_02_Billing_And_WhatsApp
  └── Requires: Phase 04 complete (Tenant model, User model, WhatsApp send utility)

SubPhase_05_03_Polish_And_Deployment
  └── Requires: SubPhase_05_01 and SubPhase_05_02 complete
  └── This is the final sub-phase of the entire project
```

---

## Phase 05 Exit Criteria

- [ ] Owner can view a Profit and Loss report for any date range with itemized revenue and expenses
- [ ] Every report page has a working CSV export
- [ ] Daily email summary is sent via Vercel Cron at 08:00 and generates a correctly formatted email
- [ ] PayHere IPN webhook correctly updates Subscription status on both success and failure payloads
- [ ] A simulated failed payment (manual status update) correctly suspends the POS after the grace period
- [ ] WhatsApp payment reminder is sent 3 days before the billing due date
- [ ] Super Admin MRR dashboard shows accurate active tenant count and total MRR
- [ ] Application deploys to production on Vercel with zero build errors
- [ ] `storename.velvetpos.com` resolves to the correct tenant dashboard
- [ ] Sentry captures a test error thrown in production and shows it in the Sentry dashboard
- [ ] `sale.completed` webhook fires within 3 seconds of sale completion
- [ ] All list views have empty states; all data fetches have loading skeletons
- [ ] WCAG 2.1 AA: all icon-only buttons have `aria-label`; focus ring visible on all interactive elements
- [ ] Demo seeder creates 90 days of sales history and all reports render with meaningful data

---

## Files Created in Phase 05 (Top-Level)

- `document-series/Phase_05_The_Platform/Phase_05_Overview.md` — This file
- `document-series/Phase_05_The_Platform/SubPhase_05_01_Reporting_And_Analytics/` — 13 documents
- `document-series/Phase_05_The_Platform/SubPhase_05_02_Billing_And_WhatsApp/` — 13 documents
- `document-series/Phase_05_The_Platform/SubPhase_05_03_Polish_And_Deployment/` — 13 documents
