# Task 05.03.12 — Final Launch Checklist and Handoff

## Metadata

| Field | Value |
|---|---|
| Task ID | 05.03.12 |
| Task Name | Final Launch Checklist and Handoff |
| SubPhase | 05.03 — Production Deployment and Polish |
| Complexity | High |
| Estimated Duration | 2–3 hours (review and verification) |
| Assignee Role | Lead Developer + Product Owner |
| Dependencies | All 11 prior tasks in SubPhase 05.03 complete; all prior phases complete |
| Output Files | This document serves as the handoff artifact. No additional source files created. |

## Objective

This document is the definitive go-live checklist for VelvetPOS. It consolidates environment validation, feature smoke testing, performance baseline assertions, security requirements, and the exact linear sequence of go-live actions into a single reviewable artefact. Upon completing every checklist item and receiving sign-off from the Product Owner, the VelvetPOS project transitions from development to a live production SaaS product. This document also serves as the project completion handoff record for any future maintainer.

## Environment Validation Checklist

All items in this section must be confirmed before the deployment step begins.

**Database**
- [ ] Production DATABASE_URL is set in Vercel environment variables pointing to the live PostgreSQL instance
- [ ] DIRECT_URL is set for Prisma Migrate operations (non-pooled connection string)
- [ ] A manual test connection is verified: pnpm prisma db pull runs without error against the production database
- [ ] The production database is hosted in a region geographically close to the majority of tenant users (Asia Pacific or South Asia region recommended for Sri Lanka-based tenants)

**Authentication**
- [ ] NEXTAUTH_SECRET is a minimum 32-character cryptographically random string generated via openssl rand -base64 32
- [ ] NEXTAUTH_URL is set to the production canonical URL (https://velvetpos.com)
- [ ] NEXT_PUBLIC_APP_URL is set correctly and matches the value used in email link generation

**Sentry**
- [ ] NEXT_PUBLIC_SENTRY_DSN is set in Vercel for all environments
- [ ] SENTRY_AUTH_TOKEN is set in Vercel for Production and Preview environments
- [ ] A Vercel preview deployment has been triggered and a test error event received in the Sentry dashboard
- [ ] Source maps are confirmed as uploaded: a Sentry issue triggered in preview resolves to TypeScript line numbers

**Payments**
- [ ] PAYHERE_MERCHANT_ID and PAYHERE_MERCHANT_SECRET are set for production (not sandbox values)
- [ ] PAYHERE_MODE is set to "live" in the production environment
- [ ] The PayHere notify_url (webhook callback URL) is registered in the PayHere merchant dashboard
- [ ] A final sandbox end-to-end payment test passes before the production key swap

**Cron Jobs and Messaging**
- [ ] CRON_SECRET is set in Vercel environment variables
- [ ] WHATSAPP_API_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and WHATSAPP_WEBHOOK_VERIFY_TOKEN are set
- [ ] All four Vercel Cron Jobs are listed in the Vercel project Cron Jobs tab
- [ ] A manual POST to /api/cron/check-subscriptions with the correct Authorization header returns HTTP 200

## Feature Smoke Test Checklist

Perform each test on the live production deployment after go-live actions are complete. Use the demo tenant (velvet-demo.velvetpos.com) for all tests.

**Authentication**
- [ ] Navigate to velvet-demo.velvetpos.com and confirm redirect to login page
- [ ] Log in with the OWNER PIN (owner@velvetdemo.com) and confirm redirect to dashboard
- [ ] Log out and confirm session destruction and redirect to login
- [ ] Log in with the CASHIER1 PIN and confirm only CASHIER-permitted menu items are visible

**Product Management**
- [ ] Create a new product with two size variants and verify it appears in the product list
- [ ] Edit the product name and confirm the update persists on page refresh
- [ ] Adjust stock for a variant and confirm the new quantity displays correctly

**POS Terminal**
- [ ] Open the POS terminal and search for "Silk Saree" — verify results appear in under 200 milliseconds
- [ ] Add two different products to the cart and apply a percentage discount
- [ ] Complete a sale with Cash payment and confirm the receipt modal appears with correct totals
- [ ] Verify the completed sale appears in the sales history list

**Returns**
- [ ] Open a recent sale from the history and initiate a return on one line item
- [ ] Confirm the return record appears in the returns log and stock quantity is restored

**Reports**
- [ ] Open the Revenue Report and confirm all three months of demo data chart bars are visible
- [ ] Export the revenue report as a CSV and confirm the file downloads and opens cleanly
- [ ] Open the Commission Report and verify both cashier users show non-zero commissions

**Billing**
- [ ] Open the Billing page and confirm the demo tenant's current plan (PROFESSIONAL) is displayed
- [ ] Click "Upgrade to Enterprise" — confirm the PayHere checkout page opens with the sandbox merchant (used for smoke test safety)
- [ ] Close the checkout without completing — confirm the subscription status is unchanged

**Webhooks**
- [ ] Register a test webhook endpoint using webhook.site (or equivalent) at /settings/webhooks
- [ ] Complete a new sale and verify the webhook.site receiver captures the sale.completed POST request within 5 seconds
- [ ] Confirm the X-VelvetPOS-Signature header is present on the received request

## Performance Baseline

The following latency targets must be met under normal load (single development machine, local PostgreSQL). Production Vercel deployments with edge caching are expected to meet or exceed these targets.

| Operation | Target | Measurement Method |
|---|---|---|
| POS terminal product search (debounced) | Under 200 milliseconds | Browser DevTools Network tab |
| Sale completion (cart to receipt) | Under 2 seconds | Stopwatch from Submit click to receipt modal open |
| Reports dashboard load (3 months data) | Under 5 seconds | Browser DevTools Network tab |
| Customer list load (10 demo customers) | Under 500 milliseconds | TanStack Query devtools |
| Login page to dashboard (after auth) | Under 1 second | Browser address bar timing |

## Security Checklist

- [ ] No .env or .env.local files are committed to the Git repository — verify with git log --all --full-history -- ".env*"
- [ ] NEXTAUTH_SECRET is not the string "secret" or "changeme" or any placeholder value
- [ ] CRON_SECRET is set and cron route handlers reject unauthorised requests with HTTP 401
- [ ] All webhook endpoint URLs are validated to HTTPS only at the API layer
- [ ] No production API route returns the raw database error message in the response body
- [ ] Rate limiting middleware (from SubPhase 01.02 Task 01.02.11) is active on the login endpoint
- [ ] The /api/test-error endpoint returns HTTP 404 in the production build (NODE_ENV check enforced)
- [ ] Sentry DSN is public (NEXT_PUBLIC_) but SENTRY_AUTH_TOKEN is not exposed to the browser
- [ ] All role-based access control guards (from SubPhase 01.02 Task 01.02.06) are verified for CASHIER, STOCK_CLERK, MANAGER, and OWNER roles on their respective restricted routes
- [ ] No console.log statements in production code output sensitive data (session tokens, raw database queries, payment secrets)

## Go-Live Steps — Exact Execution Sequence

Perform the following steps in this exact order. Do not skip or reorder.

**Step 1 — Final code merge**: Merge the production-ready main branch to ensure the Vercel production deployment reflects the latest code. Use the Vercel GitHub integration or run vercel deploy --prod.

**Step 2 — Database migration**: After the deployment succeeds, run pnpm prisma migrate deploy with the production DATABASE_URL set. This applies all pending Prisma migrations to the live database. Confirm the output shows "All migrations have been applied." with zero pending items.

**Step 3 — Initial data seed**: Run pnpm prisma db seed targeting the production database. This creates the SUPER_ADMIN account, the demo tenant, and the initial seed data. Monitor the seed log for completion in under 60 seconds.

**Step 4 — DNS propagation**: Confirm the Vercel wildcard CNAME record for *.velvetpos.com has fully propagated by running a DNS lookup for velvet-demo.velvetpos.com and verifying it resolves to Vercel's edge network. Propagation may take up to 48 hours after initial DNS record creation; confirm this step is completed at least 24 hours before the official go-live date.

**Step 5 — Smoke tests**: Execute all feature smoke tests from the Feature Smoke Test Checklist above. Mark each item complete before proceeding.

**Step 6 — PayHere key swap**: In Vercel environment variables, update PAYHERE_MERCHANT_SECRET and PAYHERE_MODE to the live production PayHere credentials. Trigger a new Vercel deployment to apply the updated environment variables. Do not test a live PayHere payment — production keys are for real transactions only.

**Step 7 — Sentry production verification**: Confirm the Sentry dashboard shows events tagged with environment: "production". Verify at least one production request is appearing in the Sentry Performance tab with a valid trace.

**Step 8 — Announce**: The platform is live. Update the project status in the team issue tracker to "Live".

## Post-Launch Monitoring (First 7 Days)

- Monitor the Sentry Issues dashboard daily. If the error rate for any event type exceeds 5 per hour, investigate immediately.
- Check that the daily summary cron job executed successfully each morning by reviewing Vercel Cron Job execution logs.
- Verify the birthday-messages and payment-reminders cron jobs execute correctly by the end of the first full week.
- Monitor Vercel Function execution logs for any functions exceeding the 10-second timeout limit; these indicate slow database queries requiring optimisation.
- Review the first month's PayHere transaction log against VelvetPOS subscription records to confirm payment webhook delivery is reliable.
- Check Prisma database query counts weekly using database metrics to identify N+1 patterns introduced under real-world traffic.

## Project Completion Summary

VelvetPOS is a multi-tenant SaaS Point-of-Sale system built for Sri Lankan clothing boutiques. The project spans five phases and 17 sub-phases covering authentication and RBAC, multi-tenant SaaS infrastructure, product catalogue management, POS terminal operations, payments and receipts, returns and exchanges, CRM and supplier management, staff and commission management, hardware integrations, subscription billing, analytics and reporting, and this final production deployment and polish sub-phase.

The complete technology foundation is Next.js 15 App Router with TypeScript strict mode, Prisma ORM with PostgreSQL, Tailwind CSS 4, ShadCN/UI component library, NextAuth.js v5, TanStack Query, Zustand, React Hook Form with Zod validation, and decimal.js for monetary arithmetic. The design system is anchored by the boutique-appropriate espresso, terracotta, sand, mist, linen, and pearl palette with Playfair Display headings and Inter body text.

The project documentation series consists of over 80 task documents organised across the document-series/ directory and serves as the authoritative implementation guide for any developer maintaining or extending the platform.

## Notes

- The go-live PayHere key swap (Step 6) is irreversible in the sense that the production merchant credentials are now active. Ensure all team members are notified before this step, and that the PayHere sandbox is never used again against the production database after the swap.
- Retain the sandbox PayHere credentials in a secure vault (not in the repository) for use in future staging and preview deployments. Preview and staging environments must always use the sandbox merchant account to prevent accidental real charges during testing.
