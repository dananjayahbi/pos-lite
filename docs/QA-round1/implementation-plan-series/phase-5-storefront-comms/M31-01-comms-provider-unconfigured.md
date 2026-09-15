# M31-01 — BUG-73: no communications provider configured — every email/WhatsApp send silently fails closed while APIs answer 200

**Severity:** P1-Critical (the module's core purpose is non-operational in this deployment) · **Module:** 31 Communications · **QA pin:** `tests/31_communications.spec.ts` L2 (gate pin) · **Depends on:** INF-03 (credentials) · **Blocks:** req 3.5, M27-08 reminders, M24 receipt/birthday sends

## Verified source state (2026-09-15) — holds
- `src/lib/whatsapp.ts` `sendWhatsAppTextMessage` (110-133): missing `WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_ACCESS_TOKEN` → returns `{ success:false, error:'WhatsApp is not configured...' }` (a normal result, not a throw).
- `src/lib/services/email.service.ts` (3-18): `getResendClient()` returns null when `RESEND_API_KEY` unset (console.warn); `sendEmail` returns `false`.
- `erp/.env` has none of these keys (INF-03 confirmed). Every transactional email (order/invoice/OTP/reset), WhatsApp broadcast/receipt/PO-send/birthday is dead while the API still returns 200 with `sent:0, failed:N`.

## Fix approach (this is INF-03's credential work + failure visibility)
1. **Credentials:** INF-03 supplies sandbox `RESEND_API_KEY` + `WHATSAPP_*` + `CRON_SECRET`; `.env.example` documents them. Until then this stays ⚠️ BLOCKED — no code can make sends actually deliver.
2. **Make silent failure loud (code, do now):** every send path that currently returns `false`/`{success:false}` must (a) surface the `PROVIDER_NOT_CONFIGURED` reason to the caller (already partially — broadcast analytics show `failed:N` with the error), and (b) write a structured log/Sentry event so ops sees the outage, not just a 200. Tie into INF-03's `/api/health` integration matrix.
3. **Broadcast honesty:** the broadcast route already reports `sent:0,failed:N` — ensure the UI toast distinguishes "0 sent because provider unconfigured" from "0 recipients matched" (different messages), so an owner isn't told a broadcast "completed" that delivered nothing.
4. Once credentials exist, upgrade L2 gate pin to a real-dispatch assertion (record-level + provider-ack), and req 3.5 bullets become verifiable.

## Files
- `email.service.ts`, `whatsapp.ts` (structured reason return), broadcast/send-receipt routes (UI message split), INF-03 health.

## Acceptance / gate
- Unconfigured: send-receipt → `WHATSAPP_FAILED` + a Sentry/log entry + a distinct UI message; `/api/health` shows email/whatsapp missing. Configured: L2 flips to a successful send (record + provider id).
