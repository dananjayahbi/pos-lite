# Delivery Integration Plan — Part 4 of 5: UI, Workflows & User Experience

**Carrier:** Trans Express
**System:** AyurPOS (ERP + Website)
**Date:** 2026-08-06
**Status:** Planned — Not Yet Implemented

---

## 1. Purpose

This document specifies the **user-facing workflows and interface structure** for the delivery module, in both the ERP (office/dispatch staff) and the customer-facing website. It defines the dispatch lifecycle, the screens, the component breakdown (modular, following the codebase conventions), shipping-label printing with dual barcodes, packaging auto-deduction, and failed-order recovery.

---

## 2. Dispatch Lifecycle (The Core Workflow)

The lifecycle is the single mental model that every screen serves. It flows from Part 1's architecture and Part 2's `DeliveryStatus`.

```
Create ──► PLACED ──► PENDING_DISPATCH ──► DISPATCHED ──► IN_TRANSIT ──► OUT_FOR_DELIVERY ──► DELIVERED
  │            │            │  (hold buffer,     │                │                │
  │            │            │   30–60 min)       │                │                └─► ledger PENDING_SETTLEMENT
  │            └────────────┼────────────────────┴────────────────┘
  └── CANCELED (before push, allowed)         │
                                             FAILED ──► recovery workflow
                                             RETURNED / CANCELED (terminal)
```

### 2.1 Step-by-step
1. **Create** — from website checkout (`WEBSITE_CHECKOUT`) or ERP form (`ERP_MANUAL`). Capture customer + shipping address + item weights + COD. Status `PLACED`.
2. **Hold buffer** — after creation, move to `PENDING_DISPATCH` with `holdExpiresAt`. Staff can edit address/COD or cancel freely during this window (Trans Express cannot edit/cancel after submission).
3. **Dispatch** — staff review the parcel, optionally assign a **manual waybill** or let Trans Express auto-issue one, then push to the API. On success: status `DISPATCHED`, waybill stored, `holdExpiresAt` cleared. **Auto-deduct packaging** (polymailer + label). Print the shipping label.
4. **Track (automated)** — the poller (Part 3 §8) advances status through `IN_TRANSIT` / `OUT_FOR_DELIVERY` and notifies staff/customer on meaningful transitions.
5. **Delivered** — on `DELIVERED`, create the COD `PENDING_SETTLEMENT` ledger entry and notify.
6. **Failure / recovery** — on `FAILED`/`RETURNED`, enter the recovery queue (follow-up, redeliver, or permanent cancel returning to stock).

---

## 3. ERP Delivery Module Screens

All pages live under the `(store)` route group so they inherit the app shell and sidebar.

### 3.1 Delivery list (`(store)/delivery/page.tsx`)
- Server page: `auth()` → feature-guard `delivery` → `hasPermission(DELIVERY.viewDelivery)` → render `DeliveryPageClient`.
- Client container: toolbar (search by order ref / customer / waybill), **status filter tabs** (All, Pending Dispatch, Dispatched, In Transit, Delivered, Failed, Returned), date range, source filter, and a **"Create Delivery"** button.
- Table columns: Order Ref, Customer, City, COD, Shipping Fee, Status badge, Waybill, Dispatched At, Actions.
- Row actions: View, Dispatch (if pending), Print Label, Track, Cancel.
- Uses `useDeliveries` react-query hook + `deliveryStore` (zustand) for selection/filter UI state.

### 3.2 Delivery detail (`(store)/delivery/[deliveryId]/page.tsx`)
- Server page fetches the delivery + shipment + events + recovery history, guarded like the list.
- Client panels:
  - **ShipmentStatusCard** — current status, waybill, carrier env, last synced, live track button.
  - **StatusTimeline** — chronological `DeliveryEvent` timeline (internal + carrier events with remarks/timestamps).
  - **OrderInfoCard** — customer, shipping address, COD, weights, fees, source, linked sale.
  - **ActionsPanel** — context-sensitive: Edit (pending), Dispatch, Print Label, Redeliver, Cancel, Add Follow-up Note.

### 3.3 Rate card (`(store)/delivery/rate-card/page.tsx`)
- CRUD for the active `RateCard` (base/extra kg, COD commission %, VAT %) and `RateCardEntry` zone overrides.
- Matrix table: origin → destination district/city → base/extra.
- Guard: `DELIVERY.manageRateCard`.

### 3.4 Packaging inventory (`(store)/delivery/packaging/page.tsx`)
- Office-only view (per SRS Module 7). List of `PackagingItem` with quantity, category, low-stock badge.
- Stock-in/adjuest actions, consumption history (`PackagingConsumption`).
- **Low-stock alerts** at threshold (notify on fall below, e.g., <50 polymailers).
- Guard: `DELIVERY.managePackaging` / `DELIVERY.dispatchPackaging`.

### 3.5 Reconciliation (`(store)/delivery/reconciliation/page.tsx`)
- COD ledger view, remittance CSV upload, matching results, discrepancy flags, dispute handling.
- Detailed in Part 5. Guard: `DELIVERY.viewReconciliation` / `importRemittance`.

### 3.6 Delivery settings (`(store)/settings` section)
- **Courier account** form (env switch, email/API key, origin defaults, pickup address) — `DELIVERY.manageCourierSettings`.
- **Sync locations now** button (calls location-sync service).
- **Module toggles** are superadmin-managed (Part 1 §8), not tenant-facing.

---

## 4. ERP Component Breakdown (Modular)

Create a `src/components/delivery/` folder mirroring the `appointments/` feature pattern. Keep presentational components small and composable; server pages stay thin.

| Component | Purpose |
|---|---|
| `DeliveryPageClient.tsx` | orchestrates list state, dialogs, filters |
| `delivery-list/DeliveryTable.tsx` | data table with status badges + actions |
| `delivery-list/DeliveryFilters.tsx` | filter bar (status, source, date, search) |
| `delivery-list/StatusBadge.tsx` | colored status chip |
| `delivery-form/CreateDeliverySheet.tsx` | form to create a delivery (ERP_MANUAL) |
| `delivery-form/AddressFields.tsx` | reusable address + city dropdown (react-hook-form) |
| `delivery-form/DispatchButton.tsx` | dispatch action with waybill mode selector |
| `delivery-detail/DeliveryDetailPanel.tsx` | layout of detail cards |
| `delivery-detail/ShipmentStatusCard.tsx` | waybill + live status + track |
| `delivery-detail/StatusTimeline.tsx` | event timeline |
| `delivery-detail/OrderInfoCard.tsx` | customer/address/COD/weights/fees |
| `delivery-detail/ActionsPanel.tsx` | edit/dispatch/print/redeliver/cancel |
| `delivery-detail/FollowUpForm.tsx` | recovery note / call log |
| `rate-card/RateCardForm.tsx` | rate card CRUD |
| `rate-card/RateMatrixTable.tsx` | zone overrides matrix |
| `packaging/PackagingPageClient.tsx` | packaging inventory client |
| `packaging/PackagingStockTable.tsx` | stock table + low-stock badges |
| `packaging/StockAdjustSheet.tsx` | stock-in/out form |
| `reconciliation/ReconciliationClient.tsx` | ledger + import orchestration |
| `reconciliation/RemittanceUpload.tsx` | CSV upload with mapping preview |
| `reconciliation/LedgerTable.tsx` | COD ledger + discrepancy flags |
| `labels/ShippingLabel.tsx` | branded shipping label (enlarged customer info) |
| `labels/DualBarcodeLabel.tsx` | dual-barcode layout (top-right internal + center courier) |

### 4.1 State & data hooks
- `src/stores/deliveryStore.ts` — zustand store for selected delivery, filter state, open dialogs (mirrors `appointmentStore`).
- Hooks in `src/hooks/`: `useDeliveries`, `useDelivery`, `useShipmentTracking`, `useRateCard`, `usePackaging`, `useReconciliation`, `useCourierSettings`, `useLocations`.
- Validators in `src/lib/validators/delivery.validators.ts` (used via `standardSchemaResolver`).

---

## 5. Shipping Label & Invoice Printing (Module 13)

### 5.1 Requirements (from SRS)
- **Prominent brand header** (Ruhunu Wedagedara logo) on labels/invoices.
- **Enlarged, bold customer info** (name, phone, address) for courier dispatch handlers.
- **Dual barcodes**: one top-right (internal office scanning / packing verification) and one large center barcode/QR (courier scanning).

### 5.2 Design guidance
- Build a print component (`labels/ShippingLabel.tsx`) rendered to a print-friendly area using the existing receipt/ESC-POS rendering utilities where appropriate; CSS print stylesheet for A6/A4 shipping labels.
- **Top-right barcode**: encode the internal `orderRef` (or delivery id) — scannable by office.
- **Center barcode/QR**: encode the **waybill id** — scannable by Trans Express couriers. Use the existing `react-barcode` library.
- **Customer block**: name, both phone numbers, full address (with city/district) in large bold type.
- Include COD amount, item count, weight, and the origin/pickup address.
- **Invoice template**: update with prominent brand header and include waybill + order ref.
- Support printing on dispatch and re-printing from the detail page.

---

## 6. Packaging Inventory Auto-Deduction (Module 7)

- On successful dispatch, deduct configured packaging items (e.g., 1 Polymailer + 1 Thermal Label per parcel) — recorded as `PackagingConsumption` linked to the delivery.
- Implement as part of the dispatch service transaction (or a post-dispatch non-blocking step with audit).
- If stock insufficient, **warn** rather than block dispatch, and surface an alert.
- **Low-stock notifications** when quantity falls below threshold (Part 5).
- Office-only visibility per the `DISPATCH_STAFF` role and `managePackaging` permission.

---

## 7. Failed-Order Recovery Workflow (Module 14)

Triggered when the poller maps a shipment to `FAILED`/`RETURNED`.

- **Queue:** the delivery list exposes a "Failed" tab; detail shows the courier **failure reason** (phone off, wrong address, postponed, customer refused).
- **Follow-up:** `FollowUpForm` logs a `DeliveryRecovery` with `action = FOLLOW_UP_CALL`, staff, notes, outcome.
- **Redeliver:** `action = REDELIVERED` — after staff contact, corrects the address/phone, creates a new dispatch (new shipment), re-pushes the order payload.
- **Permanent cancel:** `action = CANCELLED` — marks the delivery terminal `CANCELED`, returns items to stock (reuse existing stock-adjustment path), audit-logged.
- **Lifetime trail:** `DeliveryEvent` + `DeliveryRecovery` preserve the full history (failed → recovered → delivered) for auditing and staff recovery-rate metrics.
- **Staff metrics:** report assigned recoveries, recovered, cancelled per staff (Part 5 reporting).

---

## 8. Customer-Facing Website (Checkout + Tracking)

### 8.1 Checkout (`/[tenantSlug]/checkout/page.tsx`)
- Real checkout flow replacing the current dead-end cart CTA.
- Steps: **Review cart** → **Shipping address** (with city dropdown populated from synced Trans Express locations, so a valid `city_id` is captured) → **Delivery options & COD** (shipping fee shown from ERP rate engine) → **Confirmation**.
- Posts to an **ERP public endpoint** that creates the `Delivery` (`WEBSITE_CHECKOUT`) with a computed fee (server-side; never trust client fee). COD is the initial payment method (payment gateway is a separate future item).
- On success, returns an `order_ref` + confirmation and provides the tracking link.

### 8.2 Order tracking (`/[tenantSlug]/track-order/page.tsx`)
- Public page where a customer enters **Order ID or phone number** to view status.
- Posts to an ERP endpoint that looks up the delivery, returns a **masked** status pipeline + timeline (Placed → Dispatched → In Transit → Out for Delivery → Delivered) and the waybill for direct Trans Express tracking.
- **Privacy:** return only the minimal fields for that order; never expose internal notes, other customers, cost, or raw payloads. Rate-limit lookups.

### 8.3 Website data/API layer
- Add `website/src/lib/api/delivery.ts` with `placeOrder()` and `trackOrder()` using the existing `apiFetch` server helper (the website has no ORM; all writes proxy through ERP).
- Reuse `cartStore` for the cart; the checkout form needs a small client component set under `website/src/components/website/checkout/` and `.../tracking/`.
- Note: the website has no zod/form libs — either add them or implement the form with controlled state + client validation (recommend adding a light validation approach consistent with the codebase when implemented).

---

## 9. Sidebar & Navigation

- Add a **"Delivery"** nav group (or add to Operations) in `src/components/layout/StoreSidebar.tsx` with items: **Deliveries**, **Rate Card**, **Packaging**, **Reconciliation** — each filtered by the relevant `DELIVERY.*` permission and hidden when the module is disabled.
- Add the new `DISPATCH_STAFF` role to role dropdowns (staff management UI, seed, permission assignment).

---

## 10. Summary → Part 5

Part 5 (**Reconciliation, Notifications, Reporting & Roadmap**) defines the COD settlement ledger, CSV remittance import + matching engine, the notification/alert system, reporting, RBAC finalization, the implementation phases, and the complete file inventory.
