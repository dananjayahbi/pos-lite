# VelvetPOS — Final Launch Checklist and Handoff

## Environment Validation

### Database

- [ ] Production `DATABASE_URL` is set in Vercel environment variables
- [ ] `DIRECT_URL` is set for Prisma Migrate operations (non-pooled connection)
- [ ] Manual test: `pnpm prisma db pull` runs without error against production
- [ ] Production database hosted in Asia Pacific / South Asia region

### Authentication

- [ ] `NEXTAUTH_SECRET` is a minimum 32-character random string (`openssl rand -base64 32`)
- [ ] `NEXTAUTH_URL` is set to `https://velvetpos.com`
- [ ] `NEXT_PUBLIC_APP_URL` matches the value used in email link generation

### Sentry

- [ ] `NEXT_PUBLIC_SENTRY_DSN` is set in Vercel for all environments
- [ ] `SENTRY_AUTH_TOKEN` is set for Production and Preview
- [ ] Test error event received in Sentry dashboard from a preview deployment
- [ ] Source maps upload confirmed (Sentry issues resolve to TS line numbers)

### Payments

- [ ] `PAYHERE_MERCHANT_ID` and `PAYHERE_MERCHANT_SECRET` set for production
- [ ] `PAYHERE_MODE` set to `"live"` in production
- [ ] PayHere `notify_url` registered in merchant dashboard
- [ ] Final sandbox end-to-end payment test passes

### Cron Jobs & Messaging

- [ ] `CRON_SECRET` is set in Vercel
- [ ] `WHATSAPP_API_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` set
- [ ] All 4 Vercel Cron Jobs visible in Vercel project Cron Jobs tab
- [ ] Manual POST to `/api/cron/check-subscriptions` returns HTTP 200

---

## Feature Smoke Tests

### Authentication

- [ ] Navigate to velvet-demo.velvetpos.com → redirect to login
- [ ] Login with OWNER PIN → redirect to dashboard
- [ ] Logout → session destroyed, redirect to login
- [ ] Login with CASHIER1 PIN → only CASHIER-permitted menu items visible

### Product Management

- [ ] Create new product with 2 variants → appears in product list
- [ ] Edit product name → persists on refresh
- [ ] Adjust variant stock → new quantity displays correctly

### POS Terminal

- [ ] Search "Silk Saree" → results in < 200ms
- [ ] Add 2 products, apply percentage discount
- [ ] Complete Cash sale → receipt modal with correct totals
- [ ] Sale appears in sales history

### Returns

- [ ] Open recent sale → initiate return on 1 line item
- [ ] Return record in returns log, stock restored

### Reports

- [ ] Revenue Report → 3 months of chart bars visible
- [ ] Export CSV → downloads and opens cleanly
- [ ] Commission Report → both cashiers show non-zero commissions

### Billing

- [ ] Billing page → current plan (PROFESSIONAL) displayed
- [ ] "Upgrade to Enterprise" → PayHere checkout opens (sandbox)
- [ ] Close without completing → status unchanged

### Webhooks

- [ ] Register test endpoint at /settings/webhooks
- [ ] Complete sale → webhook.site receives POST within 5s
- [ ] `X-VelvetPOS-Signature` header present

---

## Performance Baseline

| Operation                              | Target     |
| -------------------------------------- | ---------- |
| POS product search (debounced)         | < 200ms    |
| Sale completion (cart to receipt)       | < 2s       |
| Reports dashboard load (3 months data) | < 5s       |
| Customer list load (10 customers)      | < 500ms    |
| Login to dashboard (after auth)        | < 1s       |

---

## Security Checklist

- [ ] No `.env` / `.env.local` committed: `git log --all --full-history -- ".env*"`
- [ ] `NEXTAUTH_SECRET` is not "secret", "changeme", or placeholder
- [ ] `CRON_SECRET` set; cron routes reject unauthorized with 401
- [ ] Webhook endpoint URLs validated to HTTPS only
- [ ] No raw database errors in API response bodies
- [ ] Rate limiting active on login endpoint
- [ ] `/api/test-error` returns 404 in production (`NODE_ENV` check)
- [ ] `SENTRY_AUTH_TOKEN` not exposed to browser
- [ ] RBAC guards verified for CASHIER, STOCK_CLERK, MANAGER, OWNER
- [ ] No `console.log` outputs sensitive data (tokens, queries, secrets)

---

## Go-Live Steps (Execute in Order)

1. **Final code merge**: Merge to main → Vercel production deployment
2. **Database migration**: `pnpm prisma migrate deploy` against production
3. **Initial data seed**: `pnpm prisma db seed` → SUPER_ADMIN + demo tenant
4. **DNS propagation**: Confirm `*.velvetpos.com` CNAME resolves to Vercel edge
5. **Smoke tests**: Execute all Feature Smoke Tests above
6. **PayHere key swap**: Update to live credentials in Vercel → redeploy
7. **Sentry verification**: Confirm `environment: "production"` events in dashboard
8. **Announce**: Update project status to "Live"

---

## Post-Launch Monitoring (First 7 Days)

- Monitor Sentry Issues daily (alert if > 5 errors/hour per event type)
- Verify daily summary cron executes each morning (Vercel Cron logs)
- Confirm birthday-messages and payment-reminders crons run by end of week 1
- Watch for Vercel Functions exceeding 10s timeout
- Review first month's PayHere transactions against subscription records
- Check Prisma query counts weekly for N+1 patterns

---

## Project Completion Summary

VelvetPOS is a multi-tenant SaaS POS system for Sri Lankan clothing boutiques.

**Tech Stack**: Next.js 15 App Router, TypeScript strict mode, Prisma ORM + PostgreSQL, Tailwind CSS 4, ShadCN/UI, NextAuth.js v5, TanStack Query, Zustand, React Hook Form + Zod, decimal.js

**Design System**: Espresso, terracotta, sand, mist, linen, pearl palette with Playfair Display headings and Inter body text.

**Phases**: 5 phases, 17 sub-phases, 80+ task documents in `document-series/`
