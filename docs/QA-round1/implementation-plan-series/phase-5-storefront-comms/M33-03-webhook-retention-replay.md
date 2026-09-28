# M33-03 — OBS-63/64/65: webhook endpoint hard-delete destroys the delivery ledger; signature has no timestamp/nonce; dispatch timeout inconsistency

**Severity:** P2/P3 bundle · **Module:** 33 Webhooks · **QA refs:** OBS-63 (cascade), OBS-64 (replay), OBS-65 (timeout) · **Depends on:** XC-05 (soft-delete policy)

## Verified source state (2026-09-15) — holds
- **OBS-63:** `DELETE /api/webhooks/endpoints/[endpointId]` is a hard delete; `WebhookDelivery.webhookEndpoint` has `onDelete: Cascade` → deleting an endpoint destroys its entire delivery ledger. This contradicts the app's soft-delete-everywhere convention (and QA verified the cascade works as coded).
- **OBS-64:** `deliverWebhook` signs with `X-Webhook-Signature` (HMAC-SHA256 over the raw body) but includes **no timestamp/nonce** → a captured body+signature replays forever.
- **OBS-65:** `dispatchWebhooks` uses a 2 s timeout; test/retry routes use the 5 s default → a slow receiver is FAILED on the inline path but SUCCESS on manual retry (inconsistent semantics for the same endpoint).

## Fix approach
1. **Endpoint deletion:** soft-delete (`deletedAt` + filter from list), or if hard-delete is kept for config hygiene, at minimum **detach** deliveries (`SET NULL` + keep the ledger with an `endpointLabel` snapshot) so the delivery history survives. Recommend soft-delete to match XC-05's convention; the delivery cascade then never fires.
2. **Signature replay:** add `X-Webhook-Timestamp` (seconds) into the signed payload (`timestamp.body`) and document receiver-side tolerance (e.g. ±5 min). Breaking change for existing consumers — none exist in production (0 endpoints live, QA note), so do it now, cheaply.
3. **Timeout:** single `WEBHOOK_TIMEOUT_MS` constant used by all three paths (5 s is the safer default; keep dispatch off the critical sale path via fire-and-forget — verify current behavior doesn't block checkout on webhook latency).

## Files
- `webhooks/endpoints/[endpointId]/route.ts` + schema (deletedAt or SET NULL), `deliverWebhook`/`dispatch.ts` (timestamp header, shared timeout constant), webhook docs note in `src/lib/webhooks/`.

## Acceptance / gate
- `tests/33` S-series: endpoint delete → deliveries preserved (or endpoint hidden but recoverable); signature includes timestamp; timeout parity (a receiver at 3 s behaves identically on dispatch and retry).
