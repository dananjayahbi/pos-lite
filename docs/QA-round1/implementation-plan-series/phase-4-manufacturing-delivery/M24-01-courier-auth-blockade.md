# M24-01 — BUG-60 (+OBS-32): Trans Express authentication failure blocks the whole dispatch pipeline; courier errors collapse to 400

**Severity:** P1-Critical (module 24 core path dead; gates req 3.1, modules 23 auto-deduct proof, 26 engine) · **Module:** 24 Delivery/Courier · **QA pins:** `tests/24_delivery_courier.spec.ts` F5 · **Depends on:** INF-03 (credentials), INF-02 (error mapping) · **Blocks:** M24-02, M26-01, REQ-07, REQ-08

## Verified source state (2026-09-15) — holds, with a sharper diagnosis
- `src/lib/courier/trans-express/auth.ts:22-45`: `authenticate()` = **API-key passthrough** if `account.apiKey` set, else email+password `POST /login/client` expecting `result.data.token`. Failure → `delivery.service.ts:344-351` throws `COURIER_AUTH_FAILED:<message>` → `mapDeliveryError` (`src/lib/api/delivery-route.ts:110`) maps it to **400 BAD_REQUEST** "Trans Express authentication failed".
- **The tenant HAS an active `CourierAccount` row** (QA: `COURIER_ACCOUNT_NOT_CONFIGURED` guard passed) — but `prisma/seed.ts` creates **no** CourierAccount (grep-confirmed; seed only enables the delivery module + dispatch user). So the row is **manually configured with invalid/expired credentials or wrong environment** (sandbox vs prod base URL). Fresh seeded DBs will instead 409 `COURIER_ACCOUNT_NOT_CONFIGURED`.
- **OBS-32 confirmed:** `COURIER_AUTH_FAILED`, `COURIER_UPLOAD_FAILED`, `COURIER_TRACKING_FAILED`, `LOCATION_SYNC_FAILED` ALL map to 400 — a courier outage looks identical to a credential problem. **NEW-F found during verification:** `DELIVERY_PAYMENT_NOT_SETTLED` (thrown at `delivery.service.ts:335`) has **no branch** → 500.

## Fix approach (code half here; credential half = INF-03 + client)
1. **Distinct error categories** in `mapDeliveryError`: auth failure → **502/424** style upstream-auth (client-chosen; recommend 502 Bad Gateway with `code:'COURIER_AUTH_FAILED'` so operators/monitors separate infra from client errors); upload/tracking/network → 502 with their codes; keep `COURIER_ACCOUNT_NOT_CONFIGURED` 409 (config), `DELIVERY_*` 400/409 as today. Add the missing `DELIVERY_PAYMENT_NOT_SETTLED` → 409 branch (NEW-F).
2. **Credential provisioning:** courier-settings UI (already redacts) gets a **Test connection** button calling `authenticate()` and reporting ok/fail distinctly (pairs with INF-03 health matrix). Client supplies valid sandbox creds; until then, dispatch stays ⚠️ BLOCKED — every dependent doc (M24-02, M26-01, REQ-07/08) inherits that gate.
3. **Seed:** add an optional dev CourierAccount (obviously-fake sandbox creds) so fresh environments exercise `COURIER_ACCOUNT_NOT_CONFIGURED` vs auth-failure paths deterministically; document it.
4. Packaging auto-deduct (req 3.10 1:1) triggers on dispatch — verify `autoDeductPackaging()` is called in `dispatchDelivery` success path during implementation; it's currently unreachable behind this bug.

## Files
- `src/lib/api/delivery-route.ts` (map + new branches), `delivery.service.ts` (error wrapping fidelity), courier-settings client (test connection), `prisma/seed.ts` (optional dev account).

## Acceptance / gate
- With sandbox creds (INF-03): `tests/24` F5 → 200 DISPATCHED + shipment row; F6 (tracking) unblocks (M24-02). Without creds: dispatch 502 `COURIER_AUTH_FAILED` (not 400) — pin updated; `DELIVERY_PAYMENT_NOT_SETTLED` → 409 not 500.
