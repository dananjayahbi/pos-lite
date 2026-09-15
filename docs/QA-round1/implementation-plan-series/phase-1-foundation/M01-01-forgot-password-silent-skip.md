# M01-01 — BUG-11: forgot-password silently skips email while a live token enables full account takeover

**Severity:** P1-Critical (security + availability) · **Module:** 01 Auth · **QA pin:** `tests/01_auth.spec.ts` 2.5 (takeover chain) · **Depends on:** INF-03 (email provider), INF-02 (error mapping)

## Verified source state (2026-09-15) — still holds
`erp/src/app/api/auth/forgot-password/route.ts`:
- Line ~77: `await sendPasswordResetEmail(...)` — the boolean return is **discarded**.
- `erp/src/lib/services/email.service.ts`: `getResendClient()` returns `null` when `RESEND_API_KEY` is unset (only a `console.warn`); `sendEmail` returns `false` without throwing. `RESEND_API_KEY` is absent from the local env (INF-03).
- Line ~90: the route always answers the neutral 200 "If that email address is registered…".
- Net effect (QA reproduced end-to-end with curl): POST forgot-password → 200; a `VerificationToken` (1 h TTL) sits live in `verification_tokens`; POST `/api/auth/reset-password` with that token → 200; credentials login with the new password → valid OWNER session. **Zero inbox access required.**

## Root cause
Two independent failures compose:
1. **Availability:** every password reset in this deployment is a silent no-op — users believe an email was sent.
2. **Security:** the neutral-success contract (correct for anti-enumeration) is applied even when delivery *failed*, so a leaked token (DB dump, log line, future "resend" feature) converts silently to full takeover — the owner never knows a reset was requested-and-succeeded.

## Fix approach (modular)
1. **Check the send result** in the route: capture `sendPasswordResetEmail`'s result. On failure, do NOT leave a live, undelivered token: delete the just-minted token (or mint-then-send-then-delete-on-failure) and record the outcome.
2. **Distinguish operator vs requester responses without enumeration:** the public response stays neutral (anti-enumeration is a *passing* QA contract — do not break tests 9.x). The failure signal goes to: (a) a `PASSWORD_RESET_DELIVERY_FAILED` audit row (actor = the target user id, like REQUESTED), and (b) the INF-03 health/integration status so ops see email is dead.
3. **Configured-provider path:** when `RESEND_API_KEY` exists, behavior is unchanged except the token is only kept if send succeeded.
4. **Admin escape hatch (out of band, not in this request path):** document that with email unconfigured, resets are impossible by design — the seeded-owner recovery path is direct DB/ops action (ties to M03-08 set-password work: an OWNER who can set another user's password can recover accounts without email).
5. Keep the 1 h TTL; add the token-cleanup-on-failure inside the same try block as mint (do not introduce the transactional pattern here — that is M01-03's job; sequence M01-03 first if both are implemented in one session).

## Files
- `src/app/api/auth/forgot-password/route.ts` (result handling + cleanup)
- `src/lib/services/email.service.ts` (return structured reason per INF-03 step 4)
- `src/lib/services/audit.service.ts` (new action constant)
- No UI change (response stays neutral).

## Acceptance / gate
- `tests/01_auth.spec.ts` 2.5 flips: token must NOT remain live when delivery failed → takeover chain impossible without email.
- Tests 2.3/2.4 (anti-enumeration) still green; 3.3 `PASSWORD_RESET_REQUESTED` audit behavior unchanged; new delivery-failed audit row asserted via `/api/audit-logs`.
- With a sandbox key (INF-03), full happy-path reset works and is audited.
