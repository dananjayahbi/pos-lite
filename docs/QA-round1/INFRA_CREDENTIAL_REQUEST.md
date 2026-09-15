# INF-03 / D1 — Client credentials request (opened 2026-09-15, W0)

**To:** Client / ops (Dananjayah BI)
**From:** QA round-1 implementation (W0)
**Re:** Sandbox keys needed to unblock the courier, payments, notifications and cron gates (decision D1)

Per `implementation-plan-series/prerequisites/INF-03-env-secrets-matrix.md`, the following
secrets are missing from the deployment environment. Until they arrive, the gated
specs stay ⚠️ BLOCKED-D1 (never "failed") and waves W1–W9 proceed unaffected.

| # | Key(s) | Purpose | Unblocks |
|---|---|---|---|
| 1 | `RESEND_API_KEY` | Transactional email (password reset, order/invoice mail, OTP) | BUG-11, tests/01 §2.5, M31 email leg |
| 2 | `PAYHERE_MERCHANT_SECRET` (+ merchant id) | Payment IPN signature verification | BUG-71, tests/30, REQ-05 payment leg |
| 3 | `CRON_SECRET` | Gates `/api/cron/*` (subscription checks, reminders, stock alerts) | OBS-49/73, reminder pipeline |
| 4 | `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_TEMPLATE_NAME` | WhatsApp broadcasts + receipts | BUG-73, tests/31 |
| 5 | Trans Express **sandbox** account (email+password or API key) | Courier dispatch/tracking sandbox | BUG-60/61/65, tests/24, M24-01/02, M26-01, W10 |

**Please provide:** sandbox/test keys where available (never production), delivered
out-of-band (not in git). When #5 lands, W10 (credential-gated completion) can run any
time after W6.

**Status checklist** (mirrored in `99-ROADMAP.md` §4): requested ☑ (2026-09-15) ·
courier sandbox ☐ · PayHere ☐ · Resend/WhatsApp ☐ · CRON_SECRET ☐.
