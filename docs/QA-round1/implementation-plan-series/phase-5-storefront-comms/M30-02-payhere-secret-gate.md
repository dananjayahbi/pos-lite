# M30-02 — BUG-71: `PAYHERE_MERCHANT_SECRET` unset — every IPN fails the signature gate behind a healthy-looking 200

**Severity:** P1-Critical (silent total payment failure; only detectable via config audit) · **Module:** 30 Payments · **QA pins:** `tests/30` S5, L1 (gate pins) · **Depends on:** INF-03 (the secret itself)

## Verified source state (2026-09-15)
- `src/app/api/webhooks/payhere/route.ts:41-54` computes `expectedSig = md5(merchant_id + order_id + payhere_amount + payhere_currency + md5(secret.toUpperCase()))` from `process.env.PAYHERE_MERCHANT_SECRET`. With the secret absent (INF-03 confirmed it is unset in `erp/.env`), the inner hash is `md5('')` — no real PayHere IPN can ever match → every notification is silently dropped (200, no processing).
- The always-200 design (OBS-47) means transport monitoring can't tell accepted from rejected IPNs; combined with the unset secret, misconfiguration is invisible to uptime checks.

## Fix approach (observability — the secret itself is INF-03's job)
1. **Startup/health signal:** INF-03's `/api/health` `integrations.payhere` status is the primary detection; additionally, if `PAYHERE_MERCHANT_SECRET` is unset, the webhook logs a distinct server-side warning on first hit (rate-limited) so a real IPN arriving into a misconfigured deployment is loud in logs/Sentry, not just a silent 200.
2. **Distinguish "rejected" vs "ignored" in the response body** (keep HTTP 200 for PayHere's retry semantics, but the JSON already carries `received`/processing fields — ensure `signatureValid:false` + `reason:'SECRET_NOT_CONFIGURED'` vs `'BAD_SIGNATURE'` are distinguishable so ops dashboards can alert).
3. **Never** loosen the gate to accept unsigned events (the signature gate correctly rejects all chaos — QA verified 38/38; that behavior is a *strength*, keep it).
4. Once INF-03 supplies a sandbox secret + M30-01 supplies a subscription/invoice, upgrade S5/L1 gate pins to a real signed-IPN → invoice PAID → subscription ACTIVE → tenant ACTIVE transition test.

## Files
- `webhooks/payhere/route.ts` (warning + body reason codes), INF-03 health integration.

## Acceptance / gate
- With sandbox secret: a correctly-signed IPN processes end-to-end (the req 3.2 "order status auto-updates to Paid/Ready to Dispatch" bullet finally ticked); without it, `/api/health` + logs make the gap obvious (not a silent 200).
