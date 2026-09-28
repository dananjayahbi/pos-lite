# M24-02 — BUG-61: tracking auto-sync path (req 3.1) — contract verification once dispatch works

**Severity:** P2-Major (strictly downstream of M24-01) · **Module:** 24 Delivery · **QA pin:** `tests/24_delivery_courier.spec.ts` F6 · **Depends on:** M24-01

## Verified source state (2026-09-15)
- `src/app/api/store/shipments/[shipmentId]/track/route.ts` exists — `requireDeliveryAuth(PERMISSIONS.DELIVERY.trackDelivery)` then `trackShipment(tenantId, shipmentId, userId)` via `delivery.service`, errors through `mapDeliveryError`. The route is implemented; QA could only fail at `expect(shipmentId).toBeTruthy()` because dispatch never produced a `CourierShipment`.
- Req 3.1 "tracking numbers auto-sync back to ERP **and customer profile**" — the sync-back side (cron `sync-shipments`, tracking events, ledger-entry creation on DELIVERED) exists (`tracking.service.ts`), but the "customer profile" half has never been exercised.

## Action (this is mostly a proof plan, not a build)
1. After M24-01 unblocks: run F6 → shipment created with waybillId, `track` returns payload with `shipmentId`; then walk a delivery to DELIVERED via sandbox → assert `CourierShipment.status`, `DeliveryEvent` rows, and the customer-facing tracking (public `track` by ref/phone — Module 28's privacy-verified path) reflects the same timeline.
2. **Verify the "customer profile" requirement concretely:** does the customer detail page surface deliveries/tracking? If absent, that's a small UI gap — add a Deliveries section to `src/app/(store)/customers/[customerId]/` (new component file) fed by existing delivery queries; flag for client confirmation whether in-ERP profile surfacing satisfies req 3.1 or they mean the storefront side (already exists via public track).
3. If any of the above fails live, split into a fix doc (append findings here before coding).

## Acceptance / gate
- `tests/24` F6 green; req 3.1 bullets 3–4 ticked in `QA_CLIENT_REQ.md` with evidence; no new 500s in the sync cron path (sandbox).
