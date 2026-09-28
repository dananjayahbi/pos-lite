# REQ-10 — Req 3.5: SMS gateway (local Sri Lankan) — not implemented; provider decision

**Severity:** P2 (client req, unbuilt channel) · **Type:** client-req gap · **Depends on:** nothing (decision), then M31-01's visibility patterns · **Refs:** req 3.5 "SMS Gateway (Local Sri Lankan Gateway)"

## Verified source state (2026-09-15)
- No SMS integration exists anywhere (Appendix-confirmed; the implemented channels are WhatsApp via Meta Cloud API — `src/lib/whatsapp.ts` — and email via Resend). Req 3.5's SMS bullets (dispatch/tracking SMS, appointment reminders, OTP) are all "Not verifiable — no SMS gateway integration exists"; WhatsApp currently substitutes for two of the three, itself blocked on credentials (M31-01).

## Fix approach (decision doc)
1. **Client questions:** (a) Which local SMS provider (Dialog, Mobitel/Mas, Lanka Bell, or an aggregator like Twilio-with-LK-routes)? (b) Does WhatsApp satisfy the "SMS" requirement (cheaper, already integrated) — recommend the client formally accept WhatsApp as the notification channel and demote SMS to optional/deferred, or procure an SMS provider + sandbox; (c) OTP: an SMS OTP surface would need a new auth flow (the codebase has PIN/verify-pin routes under `api/auth/` — check whether that's the intended OTP mechanism: `api/auth/pin/` + `verify-pin/` exist (B1 verification) — investigate what they do before assuming SMS is needed).
2. **If SMS is procured:** add `src/lib/sms.ts` mirroring the whatsapp.ts config-guard + structured-result pattern; route dispatch/tracking/reminder sends through a channel selector (per-tenant preference in settings); OTP flows reuse the existing VerificationToken machinery.
3. **If WhatsApp-substitution accepted:** annotate req 3.5 in `QA_CLIENT_REQ.md` (channel = WhatsApp, SMS deferred) and req closure rides on M31-01 credentials.

## Acceptance / gate
- A written channel decision; if built: a `tests/31` section asserting send-record + fail-closed behavior with a mock provider (never live-send in CI).
