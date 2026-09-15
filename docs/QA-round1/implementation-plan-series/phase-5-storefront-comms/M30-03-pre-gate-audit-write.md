# M30-03 — BUG-72: `InvoicePaymentEvent` audit row written BEFORE the signature gate (forgeable payment ledger)

**Severity:** P2-Major · **Module:** 30 Payments · **QA pin:** `tests/30_payments_billing.spec.ts` A1 (contract pin) · **Depends on:** M30-01 (needs invoices to exist for the write path to trigger), INF-02

## Verified source state (2026-09-15) — holds
Order of operations in `src/app/api/webhooks/payhere/route.ts`:
1. parse body (22-33); 2. compute `expectedSig`/`signatureValid` (41-54) — **only a `console.warn` if invalid, no early exit**; 3. look up invoice by `order_id` (57-61); 4. **if the invoice exists, `prisma.invoicePaymentEvent.create(...)` runs immediately (64-79)** storing the forged `payhereMd5sig` + `rawPayload` + `signatureValid:false`; 5. only at 88-91 does `if (!signatureValid) return 200` short-circuit.
- Today the write can't fire (no invoices exist — M30-01), so A1 is a passing contract pin. The moment invoices exist, any attacker who guesses a real invoice id can flood `InvoicePaymentEvent` with unverified rows that persist even though the payment was rejected — corrupting the payment-event ledger and any reconciliation built on it.

## Fix approach
1. **Gate before write:** move the `if (!signatureValid) return 200` check to immediately after signature computation (before the invoice lookup). Unsigned events are then never persisted.
2. If the team wants forensic capture of rejected attempts, do it in a **separate, clearly-untrusted** table/log (Sentry event or a `WebhookRejectedLog` with `verified:false`), never in the financial `InvoicePaymentEvent` ledger.
3. Keep the always-200 response (PayHere retry semantics) — the fix is about the write, not the status.

## Files
- `webhooks/payhere/route.ts` (reorder), optional `WebhookRejectedLog` if capture is wanted.

## Acceptance / gate
- A1 upgraded: once invoices exist, a forged-signature IPN for a real invoice id creates **zero** `InvoicePaymentEvent` rows; a correctly-signed one creates exactly one (idempotent on replay — QA verified replay safety separately).
