# M33-02 — OBS-62/66: webhook auto retry/backoff not implemented (explicit TODO); endpoint list unpaginated

**Severity:** P2-Major (integration reliability) · **Module:** 33 Webhooks · **QA refs:** OBS-62 (dispatch.ts TODO), OBS-66 · **Depends on:** M31-03 (cron/queue pattern reuse)

## Verified source state (2026-09-15) — holds
- `src/lib/webhooks/dispatch.ts:4` — `// TODO: Add retry mechanism with exponential backoff for failed deliveries`. Failed deliveries stay `FAILED` forever unless an OWNER manually hits `deliveries/[id]/retry` (the manual path is QA-verified: creates a NEW delivery row, no event duplication, N retries→N rows).
- `GET /api/webhooks/endpoints` returns all rows with no pagination (OBS-66) — fine at current scale, unbounded growth risk.

## Fix approach
1. **Auto-retry with backoff:** add a `WebhookDelivery` status machine (`PENDING → SENT / FAILED(attempt, nextRetryAt)`) and a cron route `api/cron/webhook-retries` (bearer `CRON_SECRET`, fail-closed pattern shared with M31-03's helper) that re-dispatches FAILED rows whose `nextRetryAt <= now`, up to a max attempt count (e.g. 5) with exponential backoff (1m, 5m, 25m, 2h, 10h). Each auto-retry creates a new delivery row (mirrors the manual route's already-verified no-duplication semantics).
2. Dead-letter: after max attempts, mark `EXHAUSTED` and surface in the endpoint list + optionally a notification record (the notification center exists).
3. **Pagination:** add `page/limit` (clamped) to the endpoints GET with a `total` — keep the default page size generous (50) so existing consumers are unaffected; update the UI to page or lazy-load.
4. Timeout consistency (OBS-65: 2 s dispatch vs 5 s manual) — align both to one constant with a documented rationale.

## Files
- `src/lib/webhooks/dispatch.ts`, new `api/cron/webhook-retries/route.ts`, `WebhookDelivery` schema (status/attempt/nextRetryAt) + migration, endpoints list route + UI.

## Acceptance / gate
- `tests/33` retry-no-duplication pins stay green; new: a dead-URL endpoint auto-retries with growing gaps (assert `nextRetryAt` monotonic) and reaches EXHAUSTED at max attempts; endpoints list paginates; cron fails closed without secret.
