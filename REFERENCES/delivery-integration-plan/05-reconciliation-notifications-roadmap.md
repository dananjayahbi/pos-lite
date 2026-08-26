# Delivery Integration Plan — Part 5 of 5: Reconciliation, Notifications, Reporting & Roadmap

**Carrier:** Trans Express
**System:** AyurPOS (ERP + Website)
**Date:** 2026-08-06
**Status:** Planned — Not Yet Implemented

---

## 1. Purpose

The final part of the series defines everything that wraps around the core dispatch/tracking flow: the **COD settlement ledger and reconciliation engine** (Trans Express does not expose financials via API), the **notification/alert system**, **reporting**, **RBAC finalization**, the **implementation roadmap**, and the **complete file inventory** for the whole feature.

---

## 2. COD Settlement & Reconciliation (Module 4)

### 2.1 Concept
Trans Express does **not** return COD collections, bank payouts, or fee deductions via the API. So AyurPOS maintains an **expected-receivables ledger** internally and reconciles it against **CSV remittance statements** downloaded from the Trans Express web portal.

### 2.2 Expected-receivables ledger
- When the tracking poller maps a shipment to `DELIVERED`, the service creates/updates a `ReconciliationLedgerEntry`:
  - `deliveryId`, `waybillId` (denormalized for matching), `expectedCod` (= `Delivery.codAmount`), status `PENDING_SETTLEMENT`.
- Optionally store the expected courier **delivery fee** and compute **net payout** via the rate card: `Net = GrossCOD − (deliveryFee + COD commission% + VAT%)`.
- These entries are the source of truth for "what we should collect."

### 2.3 Remittance CSV import
- **Upload UI** (`reconciliation/RemittanceUpload.tsx`): staff download the Trans Express portal CSV statement, upload it, and the system parses it into a `StatementImport` batch.
- **Parse:** use the existing `papaparse` CSV parsing already in the codebase. Column detection should be tolerant (match by header names like waybill, amount, fees, status, date) because portal exports vary. Store raw parsed rows (`StatementImport.rawRows`) and preview before matching.
- **Status flow:** `UPLOADED` → `PARSING` → `PARSED` → `MATCHING` → `COMPLETED` (or `FAILED` with `parseError`).

### 2.4 Matching engine
For each parsed statement row, match against ledger entries by **waybill id** (primary) with order ref as fallback:

| Match outcome | Ledger status | Action |
|---|---|---|
| Row matched, settled amount == expected COD | `MATCHED` → `CLEARED` | clear entry, record `settledAmount`, `settledAt` |
| Row matched, amount < expected (partial collection / deductions) | `PARTIAL_MATCH` / `DISCREPANCY` | flag for review, record discrepancy |
| Expected COD with no statement row | stays `PENDING_SETTLEMENT` | surfaced in "aging / pending COD" view |
| Statement row with no expected COD | `DISCREPANCY` | flag "unknown settlement" |

- Never auto-clear financial discrepancies; always leave a human-review step.
- **Idempotent import:** re-uploading the same statement (dedup by statement batch + waybill) must not double-settle.

### 2.5 Pending COD & dispute dashboard
- **Aging tracker:** delivered-but-unsettled entries grouped by days outstanding; flag **RED** when beyond a credit period (e.g., 7–14 days) → notify owner.
- **Dispute engine:** a `DISPUTED` status + note field on ledger entries for missing payments or calculation errors; a simple dispute ticket record (reuse `DeliveryRecovery` or a dedicated small note) to track resolution.

### 2.6 Guards
- View: `DELIVERY.viewReconciliation`. Import: `DELIVERY.importRemittance`. Both restricted from `CASHIER`/`STOCK_CLERK`.

---

## 3. Notifications & Alerts

Append the new `NotificationType` values (Part 2 §2.14) and create notifications following the existing inline `notificationRecord.createMany` pattern (or a small shared helper). All are **non-blocking** side effects wrapped in try/catch.

| Event | NotificationType | Recipients / channel |
|---|---|---|
| Dispatch succeeds | `DELIVERY_DISPATCHED` | OWNER/MANAGER/DISPATCH_STAFF (in-app) |
| Status advances to a meaningful state (In Transit / Out for Delivery) | `DELIVERY_STATUS_UPDATED` | staff (in-app); customer (SMS/WhatsApp/email — see below) |
| Shipment Delivered | `DELIVERY_DELIVERED` | staff + customer |
| Shipment Failed / Returned | `DELIVERY_FAILED` | dispatch staff, recovery queue |
| Packaging stock below threshold | `PACKAGING_LOW_STOCK` | office/dispatch staff + owner |
| Reconciliation discrepancy / partial COD | `RECONCILIATION_DISCREPANCY` | owner/manager |
| Hold-buffer expiry warning | `DELIVERY_HELD_EXPIRING` | dispatch staff |
| Aging pending COD beyond credit period | `COD_PENDING_ALERT` | owner |

### 3.1 Customer notifications (status updates)
- Trans Express gives no push; the **poller** is the trigger.
- Reuse the existing **WhatsApp** (`whatsapp.ts`) and **email** (`email.service.ts`) infrastructure to message customers on `Out for Delivery` / `Delivered` / `Failed` transitions, using the tenant's configured template/phone.
- Include the waybill and a tracking link; keep message content template-driven.

---

## 4. Reporting & Analytics

Add delivery reporting to the `reports` area, following the existing report-client pattern. All reports are tenant-scoped and permission-guarded (`REPORT.*` or `DELIVERY.*`).

| Report | Contents |
|---|---|
| **Dispatch log** | all deliveries in range: order ref, customer, city, waybill, status, COD, fees, dispatched/delivered dates |
| **Shipment status summary** | counts by status (dispatched, in transit, delivered, failed, returned) |
| **COD settlement report** | ledger entries: expected vs settled, pending aging, cleared totals |
| **Failed-order recovery report** | per staff: assigned recoveries, recovered, redelivered, cancelled (recovery rates) |
| **Packaging consumption report** | usage by item/category over period |
| **Shipping fee / revenue report** | collected shipping fees vs rate-card expectation, net payout projection |

Export as CSV/Excel per existing report-export patterns; the pending-COD aging view should also be exportable.

---

## 5. RBAC Finalization

- Add `DISPATCH_STAFF` to `UserRole` (Part 2 §2.15).
- Add the `DELIVERY.*` permission group (Part 1 §9) — `PermissionKey`/`ALL_PERMISSIONS`/OWNER auto-update.
- Define curated `ROLE_PERMISSIONS`:
  - OWNER / SUPER_ADMIN: all delivery permissions.
  - MANAGER: all except sensitive config/financial where appropriate.
  - DISPATCH_STAFF: view/create/dispatch/track/packaging/recovery; not rate-card config, courier settings, reconciliation.
  - CASHIER / STOCK_CLERK: none by default.
- Update: staff-management UI role dropdowns, seed defaults, sidebar nav filtering, and any hard-coded role checks to recognize `DISPATCH_STAFF`.
- Ensure the superadmin feature-modules manager exposes the `delivery` (and later `onlineCheckout`) toggles (Part 1 §8).

---

## 6. Implementation Roadmap (Phased)

Follow the SRS Gap Analysis priority classes. Each phase is independently shippable and follows the modular conventions.

### Phase 1 — Foundation & Dispatch (Module 3 core)
- Schema: delivery/shipment/address models, courier account, rate card (Part 2 §8, migrations 1–2).
- Permissions + `DISPATCH_STAFF` role + feature toggles.
- Courier adapter: login/auth, single-order upload (auto + manual), tracking call (Part 3).
- ERP: create delivery, hold buffer, dispatch, waybill persistence, delivery list + detail + track.
- Shipping label with dual barcodes + brand header (Module 13).
- Packaging inventory + auto-deduction (Module 7).
- **Exit criteria:** staff can create, hold, dispatch, and track a real (staging) Trans Express order end-to-end; label prints; packaging deducts.

### Phase 2 — Website Checkout & Tracking (Module 2 + tracking)
- Public checkout with address + city dropdown + COD + fee (ERP rate engine).
- Public order-tracking page.
- Location sync (provinces/districts/cities) + city resolver.
- **Exit criteria:** a customer can place an order on the website and track it; city ids are valid.

### Phase 3 — Reconciliation & Recovery (Modules 4, 14)
- Expected-receivables ledger on `DELIVERED`.
- CSV remittance import + matching engine + discrepancy flags + pending-COD aging dashboard.
- Failed-order recovery workflow (follow-up, redeliver, permanent cancel) + lifetime trail + staff metrics.
- Notifications for status/delivered/failed/discrepancy/low-stock/aging COD.
- **Exit criteria:** a portal statement upload reconciles expected COD correctly; failed orders recover to delivered with full audit trail.

### Phase 4 — Reporting & Polish
- Dispatch/settlement/recovery/packaging/fee reports + exports.
- Customer status notifications (WhatsApp/email).
- Rate-card refinement, bulk-upload adapter, multi-parcel weigh-in support.
- **Exit criteria:** all delivery reports correct and exportable; customer notified on delivery.

---

## 7. Complete File Inventory (What to Create)

This consolidates the folder/file plan from Part 1 §10. Implementers create files per module (do not dump into monolithic existing files).

### 7.1 Schema / data
- `erp/prisma/schema.prisma` — new enums + models + `Tenant` back-relations (edited, not new file).
- Migrations: `add_delivery_and_shipment_models`, `add_courier_accounts_and_rate_cards`, `add_packaging_inventory_models`, `add_recovery_and_reconciliation_models`, `add_dispatch_staff_role_and_notification_types`.
- `erp/prisma/seed.ts` — idempotent additions for demo courier account / rate card (edited).

### 7.2 ERP backend
- `erp/src/lib/courier/types.ts`
- `erp/src/lib/courier/trans-express/client.ts`
- `erp/src/lib/courier/trans-express/auth.ts`
- `erp/src/lib/courier/trans-express/orders.ts`
- `erp/src/lib/courier/trans-express/tracking.ts`
- `erp/src/lib/courier/trans-express/locations.ts`
- `erp/src/lib/courier/trans-express/mappers.ts`
- `erp/src/lib/courier/trans-express/errors.ts`
- `erp/src/lib/services/delivery.service.ts`
- `erp/src/lib/services/shipment.service.ts`
- `erp/src/lib/services/tracking.service.ts`
- `erp/src/lib/services/rate-engine.service.ts`
- `erp/src/lib/services/location-sync.service.ts`
- `erp/src/lib/services/packaging.service.ts`
- `erp/src/lib/services/reconciliation.service.ts`
- `erp/src/lib/validators/delivery.validators.ts`, `shipment.validators.ts`, `ratecard.validators.ts`, `packaging.validators.ts`, `reconciliation.validators.ts`
- `erp/src/lib/constants/courier.ts`
- `erp/src/lib/utils/courier.ts`
- `erp/src/lib/constants/permissions.ts` (edited — add `DELIVERY` group)
- `erp/src/lib/feature-guard.ts` (edited — add module names)

### 7.3 ERP API routes
- `erp/src/app/api/store/deliveries/route.ts`, `[deliveryId]/route.ts`
- `erp/src/app/api/store/shipments/[shipmentId]/track/route.ts`
- `erp/src/app/api/store/delivery/ratecard/route.ts`, `delivery/locations/route.ts`, `delivery/settings/route.ts`
- `erp/src/app/api/store/packaging/route.ts`, `[id]/route.ts`
- `erp/src/app/api/store/reconciliation/route.ts`, `reconciliation/import/route.ts`
- `erp/src/app/api/cron/sync-locations/route.ts`
- `erp/src/app/api/cron/sync-shipments/route.ts`
- `erp/src/app/api/cron/clear-held-deliveries/route.ts`
- `erp/src/app/api/webhooks/trans-express/route.ts` (reserved)

### 7.4 ERP frontend
- Pages: `erp/src/app/(store)/delivery/page.tsx`, `[deliveryId]/page.tsx`, `rate-card/page.tsx`, `packaging/page.tsx`, `reconciliation/page.tsx`
- `erp/src/components/delivery/*` (all components from Part 4 §4)
- `erp/src/stores/deliveryStore.ts`
- Hooks: `erp/src/hooks/useDeliveries.ts`, `useDelivery.ts`, `useShipmentTracking.ts`, `useRateCard.ts`, `usePackaging.ts`, `useReconciliation.ts`, `useCourierSettings.ts`, `useLocations.ts`
- `erp/src/components/layout/StoreSidebar.tsx` (edited — add Delivery nav group)
- Reports: `erp/src/app/(store)/reports/delivery/...` + `erp/src/components/reports/delivery/...`

### 7.5 Website
- `website/src/app/[tenantSlug]/checkout/page.tsx`
- `website/src/app/[tenantSlug]/track-order/page.tsx`
- `website/src/lib/api/delivery.ts`
- `website/src/components/website/checkout/*`
- `website/src/components/website/tracking/*`

---

## 8. Cross-Cutting Checklist (Apply to Every Phase)

- [ ] Multi-tenant: every model/query `tenantId`-scoped; `Tenant` back-relations added.
- [ ] Money via `decimal.js`, 2-dp LKR.
- [ ] Zod validators mirror services; react-hook-form + `standardSchemaResolver`.
- [ ] Auth + `hasPermission` on every route/page; feature-guard on pages/APIs.
- [ ] Audit logs on dispatch/cancel/redeliver/rate-card/packaging/reconciliation changes.
- [ ] Notifications non-blocking; new `NotificationType` values added.
- [ ] Adapter-only outbound HTTP to Trans Express; never direct from services.
- [ ] Sentry tenant context at service entry.
- [ ] Idempotency on dispatch + import.
- [ ] Follow modular file layout; new components in distinct files.

---

## 9. Conclusion

This five-part series specifies a complete, carrier-agnostic delivery capability for AyurPOS with a concrete Trans Express adapter:

- **Part 1** framed the scope, current state, architecture, toggles, and permissions.
- **Part 2** defined the schema (enums, models, relations, indexes, migrations).
- **Part 3** defined the Trans Express API integration (auth, endpoints, mapping, errors, poller, rate engine).
- **Part 4** defined the UI, dispatch lifecycle, labels, packaging, recovery, and website flows.
- **Part 5** (this) defined reconciliation, notifications, reporting, RBAC, the roadmap, and the file inventory.

Implementation proceeds phase-by-phase following the modular conventions of the existing codebase, with Trans Express as the first concrete carrier adapter and the architecture ready to accept additional carriers in the future.
