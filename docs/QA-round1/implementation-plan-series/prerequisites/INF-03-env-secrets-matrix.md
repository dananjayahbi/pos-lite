# INF-03 — Environment / secrets configuration matrix

**Type:** prerequisite / deployment-config · **Severity:** P1 (gates the courier, payments, and communications modules) · **Depends on:** nothing · **Blocks:** M24-01/02, M26-01, M30-02, M31-01, M01-01 (email delivery), plus the cron fail-closed surfaces

## Verified source state (2026-09-15)
- `erp/.env.local` does **not** exist. `erp/.env` exists, is **git-ignored** (`.gitignore:34 .env*`) and **not committed** — so no live secret is in the repo (verified via `git ls-files`/`git check-ignore`). It contains DB, R2, Supabase, Auth-secret names but is **missing every provider key** below.
- Missing → each consumer fails closed with a healthy-looking HTTP 200, which is exactly what QA could not distinguish from working code:

| Key | Consumer | Current no-key behavior | QA bug gated |
|---|---|---|---|
| `RESEND_API_KEY` | `src/lib/services/email.service.ts` (`getResendClient` returns null → `sendEmail` returns `false`) | password-reset / order / invoice / OTP emails silently skipped | BUG-11, BUG-73 |
| `PAYHERE_MERCHANT_SECRET` | `src/app/api/webhooks/payhere/route.ts` (md5 sig computed from empty secret) | every IPN fails signature gate → payments never confirm | BUG-71 |
| `CRON_SECRET` | `src/lib/cron-auth.ts` + all `/api/cron/*` | cron routes 401 for every caller → subscription checks, reminders, batch/raw-material/petty-cash alerts never run | BUG-73 class, OBS-49/73 |
| `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_TEMPLATE_NAME` | `src/lib/whatsapp.ts` (`sendWhatsAppTextMessage` config guard) | broadcasts/receipts/PO-send fail closed "WhatsApp is not configured" | BUG-73 |
| Trans Express (`TRANS_EXPRESS_*` / courier account credentials, resolved per-tenant via `CourierAccount` + `src/lib/courier/trans-express/auth.ts`) | dispatch/track | `authenticate()` fails → "Trans Express authentication failed" → no shipment | BUG-60, BUG-61, BUG-65 |

## Goal
Turn "unconfigured → silent 200" into a **documented, validated, observable** configuration surface so the blocked modules become testable and misconfiguration is loud, not silent.

## Steps
1. **Config schema + startup validation.** Add a typed env module (e.g. `src/lib/config/env.ts`, Zod-parsed) that reads every provider key and classifies each as `configured` / `missing`. Do not crash the app on missing optional providers (dev must boot), but expose the status.
2. **`/api/health` extension.** Return a `integrations` sub-object: `{ email: 'missing', payhere: 'missing', whatsapp: 'missing', courier: 'configured', cron: 'missing' }` (names/status only, never values). This makes BUG-71/73's "healthy 200 hiding total failure" observable to ops and to the QA gate.
3. **`.env.example`.** Create a fully-commented `erp/.env.example` listing every key above with the variable *name* and a placeholder, so a fresh deployment knows exactly what to set. Reference it from `erp/README.md`.
4. **Fail-closed → fail-loudly at the call site.** Where a send is attempted but the provider is unconfigured, the service must return a structured `{ success:false, reason:'PROVIDER_NOT_CONFIGURED' }` that callers surface (toast / `sent:0,failed:N` analytics already exist) rather than a bare `false`. Pair with M31-01 (broadcast visibility) and M01-01 (forgot-password must not claim success when email was skipped).
5. **Courier credentials are per-tenant** (`CourierAccount` rows), not env. Provide the sandbox credential + a documented "verify connection" action (the courier-settings surface already redacts credentials) so the client can validate Trans Express access before Module 24 re-runs.

## What this doc does NOT decide
- It does not obtain real credentials — that is a client/ops action (roadmap flags BUG-60/71/73 as ⚠️ BLOCKED pending valid sandbox keys). This doc makes the app *ready* for them and *honest* about their absence.

## Acceptance / gate
- `/api/health` shows the integration status matrix (assertable in a new/extended `tests/35_audit_health.spec.ts` health section).
- With a sandbox `RESEND_API_KEY` set, `tests/01_auth.spec.ts` 2.5 (BUG-11 takeover pin) is re-run: forgot-password either delivers or reports failure — no silent success. (Actual key delivery is client-side; the code gate is the honest-status + no-false-success behavior.)
- With courier sandbox creds set, `tests/24_delivery_courier.spec.ts` §F5/§F6 (BUG-60/61) become runnable — this is the unblock that M24-01/M24-02/M26-01 depend on.

## Notes
- Keep secret *names* in docs/tests only; never print values. `erp/.env` currently holds live-looking DB/R2/Supabase values in the working tree (uncommitted) — flag to the user separately that these must never be committed and should be rotated if the machine is shared.
