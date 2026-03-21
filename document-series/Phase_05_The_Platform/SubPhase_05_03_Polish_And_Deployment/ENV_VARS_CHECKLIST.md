# VelvetPOS — Environment Variables Checklist

## Database

- `DATABASE_URL` — Full PostgreSQL connection string (ALL envs, required)
- `DIRECT_URL` — Direct non-pooled connection for Prisma Migrate (Production)

## Authentication

- `NEXTAUTH_URL` — Canonical deployment URL e.g. https://velvetpos.com (ALL envs)
- `NEXTAUTH_SECRET` — Min 32-char random string: `openssl rand -base64 32` (ALL envs)
- `NEXT_PUBLIC_APP_URL` — Public-facing base URL for email links (ALL envs)

## Sentry

- `NEXT_PUBLIC_SENTRY_DSN` — Sentry project DSN (ALL envs)
- `SENTRY_AUTH_TOKEN` — Sentry internal integration token for source map upload (Prod/Preview only, NEVER client-side)
- `SENTRY_ORG` — Sentry org slug (Prod/Preview)
- `SENTRY_PROJECT` — Sentry project slug (Prod/Preview)

## Payments (PayHere)

- `PAYHERE_MERCHANT_ID` — PayHere merchant ID
- `PAYHERE_MERCHANT_SECRET` — PayHere merchant secret for IPN verification
- `PAYHERE_SANDBOX` — Set "true" for sandbox, omit for production

## WhatsApp / Messaging

- `WHATSAPP_API_TOKEN` — Meta/Twilio WhatsApp API token
- `WHATSAPP_PHONE_NUMBER_ID` — WhatsApp business phone number ID
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN` — Webhook verification token

## Infrastructure

- `CRON_SECRET` — Secret for Vercel cron job auth: `openssl rand -hex 20`
- `NODE_ENV` — Set by Vercel automatically

## DNS (Vercel Configuration)

CNAME record: name `*` → value `cname.vercel-dns.com`
In Vercel → Domains → add `*.velvetpos.com`

## Deployment Checklist

1. Set all env vars in Vercel for Production
2. Push main branch (triggers auto-deploy) or `vercel deploy --prod`
3. Apply migrations: `pnpm prisma migrate deploy`
4. Seed data: `pnpm prisma db seed`
5. Smoke-test: login, POS terminal, test sale, reports, billing
6. Test Sentry: call `/api/test-error` on preview
7. Test PayHere sandbox payment + webhook callback
8. Verify cron jobs listed in Vercel dashboard
