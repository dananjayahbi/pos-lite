# Task 05.03.05 — Build Production Deployment Configuration

## Metadata

| Field | Value |
|---|---|
| Task ID | 05.03.05 |
| Task Name | Build Production Deployment Configuration |
| SubPhase | 05.03 — Production Deployment and Polish |
| Complexity | Medium |
| Estimated Duration | 2–3 hours |
| Assignee Role | Lead Developer / DevOps |
| Dependencies | All prior tasks complete, Vercel project configured, cron API routes exist from Phase 04 |
| Output Files | vercel.json, document-series/Phase_05_The_Platform/SubPhase_05_03_Polish_And_Deployment/ENV_VARS_CHECKLIST.md |

## Objective

Produce the vercel.json deployment configuration file that declares all cron jobs required to run VelvetPOS background processes on a schedule, and create a companion ENV_VARS_CHECKLIST.md document that catalogues every environment variable that must be configured in the Vercel project settings before the first production deployment. Establish the complete step-by-step deployment checklist that a developer or operator can follow to launch VelvetPOS to production from a clean state.

## Instructions

**Step 1: Create vercel.json at the Project Root**

Create the file vercel.json at the root of the repository. This file controls deployment behaviour on Vercel including cron job scheduling and framework configuration. Set the build configuration to use pnpm run build as the build command and .next as the output directory, matching what Vercel infers automatically for Next.js projects. The most important section is the crons array, which declares the scheduled background jobs.

Declare the following four cron entries in the crons array, each with a path and a schedule in standard UNIX cron syntax:

The daily summary cron is at the path /api/cron/daily-summary and should run once daily at 06:00 UTC (schedule: "0 6 * * *"). This job generates the previous day's sales summary and dispatches notification emails or WhatsApp messages to tenant owners.

The birthday messages cron is at the path /api/cron/birthday-messages and runs daily at 08:00 UTC (schedule: "0 8 * * *"). This sweeps the Customer table for records whose birthdate matches today's month and day, then triggers the WhatsApp birthday greeting workflow.

The payment reminders cron is at the path /api/cron/payment-reminders and runs daily at 09:00 UTC (schedule: "0 9 * * *"). This queries overdue layaway balances and dispatches WhatsApp payment reminders per tenant configuration.

The subscription check cron is at the path /api/cron/check-subscriptions and runs daily at 00:30 UTC (schedule: "30 0 * * *"). This checks subscription expiry dates, downgrades expired subscriptions to the free tier, and triggers renewal reminder emails.

**Step 2: Secure the Cron Route Handlers**

Each of the four cron route handlers must verify a shared secret before executing their business logic. The secret is stored in the CRON_SECRET environment variable. At the start of each cron route handler, read the Authorization header from the request. If the header value does not equal "Bearer " followed by process.env.CRON_SECRET, return HTTP 401 immediately. Vercel automatically sets the Authorization header on cron invocations using the value from the CRON_SECRET variable, so this check is transparent in production. Document this pattern in the cron route file comments.

**Step 3: Create the ENV_VARS_CHECKLIST.md Document**

Create the file ENV_VARS_CHECKLIST.md in the SubPhase_05_03_Polish_And_Deployment folder. This document lists every environment variable required by VelvetPOS, grouped by category, with a description and whether each variable is required for production, preview, or development environments.

The document should group variables under the following headings:

Under "Database", list DATABASE_URL (the full Prisma PostgreSQL connection string including credentials and database name, required for all environments) and DIRECT_URL (the direct non-pooled connection URL required by Prisma Migrate operations in production).

Under "Authentication", list NEXTAUTH_URL (the full canonical URL of the deployment, e.g. https://velvetpos.com for production), NEXTAUTH_SECRET (a minimum 32-character random string — generate with openssl rand -base64 32), and NEXT_PUBLIC_APP_URL (the public-facing base URL used in email links).

Under "Sentry", list NEXT_PUBLIC_SENTRY_DSN (the Sentry project DSN, prefixed NEXT_PUBLIC since it is needed client-side), and SENTRY_AUTH_TOKEN (the Sentry internal integration token for source map upload — production and preview only, never exposed to the browser).

Under "Payments", list PAYHERE_MERCHANT_ID, PAYHERE_MERCHANT_SECRET, PAYHERE_MODE (set to "sandbox" for preview, "live" for production), and NEXT_PUBLIC_PAYHERE_MERCHANT_ID (the merchant ID exposed to the PayHere client-side widget).

Under "WhatsApp / Messaging", list WHATSAPP_API_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and WHATSAPP_WEBHOOK_VERIFY_TOKEN.

Under "Infrastructure", list CRON_SECRET (a random secret used to authenticate Vercel cron invocations — generate with openssl rand -hex 20), and NEXT_PUBLIC_POSTHOG_KEY and NEXT_PUBLIC_POSTHOG_HOST if PostHog analytics was added.

Under "DNS (Vercel Configuration)", document the wildcard subdomain CNAME record: "In your DNS provider, add a CNAME record with name * pointing to cname.vercel-dns.com. In Vercel project settings under Domains, add *.velvetpos.com as a custom domain."

**Step 4: Document the Full Deployment Checklist**

In the task's Expected Output section and inline in the ENV_VARS_CHECKLIST.md document, describe the full linear deployment procedure:

First, confirm all environment variables from ENV_VARS_CHECKLIST.md are set in the Vercel project settings for the Production environment. Second, push the main branch to GitHub — Vercel's GitHub integration triggers an automatic production deployment. Alternatively, deploy manually from the CLI by running vercel deploy --prod. Third, after deployment, apply the database schema by running pnpm prisma migrate deploy targeting the production DATABASE_URL — this applies all pending migrations in order without resetting data. Fourth, seed the demo tenant and initial data by running pnpm prisma db seed. Fifth, smoke-test five key routes: the login page, the POS terminal, a test sale completion, the reports dashboard, and the billing page. Sixth, trigger a test error by calling the /api/test-error endpoint in a non-production-like preview environment and confirm the event reaches Sentry. Seventh, perform a PayHere sandbox test payment and confirm the webhook callback updates the subscription status. Eighth, enable Vercel Cron Jobs in the Vercel project settings (Cron Jobs tab) and confirm all four jobs are listed.

## Expected Output

- vercel.json — Cron job declarations for daily-summary, birthday-messages, payment-reminders, and check-subscriptions
- document-series/Phase_05_The_Platform/SubPhase_05_03_Polish_And_Deployment/ENV_VARS_CHECKLIST.md — Full catalogue of required environment variables with descriptions and environment scoping

## Validation

- [ ] vercel.json is valid JSON and all four cron entries have correct path and schedule fields
- [ ] Cron routes return HTTP 401 when called without the correct Authorization: Bearer {CRON_SECRET} header
- [ ] ENV_VARS_CHECKLIST.md covers all six categories: Database, Authentication, Sentry, Payments, Messaging, and Infrastructure
- [ ] pnpm run build succeeds locally using the same build command declared in vercel.json
- [ ] Vercel dashboard lists all four scheduled jobs after deployment with correct schedules
- [ ] pnpm prisma migrate deploy runs against the production connection string without errors
- [ ] Wildcard CNAME DNS configuration is documented with exact record syntax in ENV_VARS_CHECKLIST.md

## Notes

- Vercel's free tier supports up to two cron jobs. The four cron jobs declared here require at minimum the Vercel Pro plan. Confirm the plan tier before deploying the cron configuration.
- The DIRECT_URL environment variable is required when using a connection pooler (e.g., PgBouncer or Supabase Pooler) in production. Prisma Migrate must use the direct connection (non-pooled) to execute DDL statements correctly. If using Prisma Postgres (Prisma's managed cloud database), both DATABASE_URL and DIRECT_URL are provided in the Prisma Console connection string panel.
