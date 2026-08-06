# Delivery Integration Plan — Part 1 of 5: Overview, Goals & Architecture

**Client/Brand:** Ruhunu Wedagedara (Ayurvedic Products)
**System:** AyurPOS (ERP + Customer-Facing Website)
**Carrier:** Trans Express (Sri Lankan courier)
**Date:** 2026-08-06
**Status:** Planned — Not Yet Implemented

---

## 1. Purpose of This Document Series

This is the **first of five coordinated planning documents** that define how AyurPOS will connect to the Trans Express courier API to dispatch physical orders and track them to delivery. The series is written to be consumed **in order**, from architecture down to implementation details:

| # | Document | Covers |
|---|----------|--------|
| 1 | **Overview, Goals & Architecture** (this file) | Why, scope, current state, high-level design, toggles, permissions, conventions |
| 2 | **Data Model & Schema Design** | Every new Prisma enum, model, relation, index and migration strategy |
| 3 | **Courier Integration Layer (Trans Express API)** | All API endpoints, auth, request/response mapping, error handling, poll worker, rate engine |
| 4 | **UI, Workflows & User Experience** | ERP delivery dashboard, dispatch workflow, shipping labels, packaging inventory, failed-order recovery, website checkout + tracking |
| 5 | **Reconciliation, Notifications, Reporting & Roadmap** | COD settlement ledger, CSV remittance import, reconciliation engine, alerts, reporting, RBAC, phased delivery |

**Explicit constraint:** These documents contain **guidance and specifications only — no code snippets**. The implementation will be authored in a later step following the modular patterns already established in the codebase.

---

## 2. Executive Summary

AyurPOS currently has **no physical delivery capability**. Sales are counter (POS) transactions, the customer-facing website has a cart but **no checkout**, and there is no courier connection. The SRS Gap Analysis identifies Modules 2 (Order Management & Checkout), 3 (Logistics & Courier Integration), 4 (Financial Reconciliation), and 14 (Failed Order & Return Recovery) as **entirely missing** — all four are prerequisites for a complete delivery integration.

This plan introduces a **Delivery & Courier Module** that:

1. Lets tenants create **dispatchable deliveries** from ERP orders (initially from the website checkout and manual office entry), attach a **Trans Express shipment**, and obtain a **waybill/tracking number**.
2. Runs a **scheduled status poller** that keeps shipment status current because Trans Express provides **no webhooks**.
3. Provides a **local shipping-rate engine** because Trans Express offers **no rate-estimation API**.
4. Implements a **COD reconciliation ledger** with **CSV remittance import** because settlement data is **not returned by the API**.
5. Adds **order tracking** on the customer-facing website using the stored waybill.
6. Adds the operational machinery around dispatch: **shipping-label printing with dual barcodes**, **packaging inventory auto-deduction**, and a **failed-order recovery workflow**.

---

## 3. Reference Sources

The plan is grounded in three authoritative documents:

- **`REFERENCES/trans-express-api-official-documentation.md`** — authoritative endpoint list, payloads, base URLs, and example responses.
- **`REFERENCES/Trans Express API & System Architecture Specification.md`** — capabilities matrix and the system-level architectural bridges required for the API's gaps (rate engine, poller, hold buffer, reconciliation).
- **`REFERENCES/SRS Gap Analysis - Current System vs Requirements.md`** — the gap analysis defining which SRS requirements are missing and which modules to build.

Where these conflict, the **official API documentation** wins (e.g., endpoint URLs and field names).

---

## 4. Scope

### 4.1 In Scope (Phase 1 delivery)

- Trans Express **account configuration** per tenant (staging/production switch, credentials).
- **Dispatch pipeline**: create a delivery → hold buffer → push to Trans Express → persist waybill.
- **Shipment lifecycle tracking** via a scheduled poller.
- **Order status pipeline**: Placed → Confirmed → Dispatched → In Transit → Delivered (plus Failed/Returned/Canceled).
- **Local shipping-rate engine** driven by a per-tenant **rate card**.
- **COD reconciliation**: expected-receivables ledger + CSV remittance import + matching engine.
- **ERP delivery dashboard** (list, detail, dispatch, track, print label).
- **Shipping label + invoice printing** with dual barcodes.
- **Packaging inventory** with auto-deduction on dispatch.
- **Failed-order recovery** (follow-up call log, redeliver, permanent cancel).
- **Website checkout + order-tracking** integration for the customer.
- New **RBAC role(s)** and **permissions** for office/dispatch staff.

### 4.2 Out of Scope (explicitly deferred)

- **Full e-commerce payment gateway** for online orders (PayHere for customer orders is a separate future work item; dispatch can still be exercised from ERP-created deliveries).
- Multi-carrier support (Domex, PromptX, Koombiyo). The architecture keeps the carrier **behind an abstraction** so additional carriers can be added later without rework.
- **Other warehouse/factory modules** (raw materials BOM, factory role) — separate SRS modules, not required to ship Trans Express.
- Trans Express **web management portal** automation (voiding waybills, deposits) — done manually by staff as the API cannot edit/cancel.

---

## 5. Current-State Analysis (What Exists Today)

Established by codebase research. This determines what the delivery module must **integrate with** vs **create new**.

### 5.1 Data Layer (Prisma, PostgreSQL)
- Multi-tenant: every owned table carries `tenantId` + a back-relation on `Tenant`.
- **`Customer`** model has `name`, `phone`, `email`, `gender`, `birthday`, `tags`, `notes`, `totalSpend`, `creditBalance` — **but no address fields**. Delivery needs a shipping address; this is **not on the Customer** today.
- **`Sale`** is the POS counter-sale (cash/card/split). There is **no standalone e-commerce `Order`** and **no shipment/delivery entity**.
- **`NotificationRecord`** exists with an enum `NotificationType`; new delivery-related notification types will be appended.
- **`AuditLog`** exists with before/after JSON snapshots and an actor trail — the delivery module must write audit logs for every dispatch/status mutation.
- `Tenant.settings` is a JSON blob already used for feature toggles (`enabledModules`) and store metadata.

### 5.2 Backend Patterns
- **Services** (`src/lib/services/*.service.ts`): exported async functions, `tenantId` first arg, `prisma.$transaction` with a shared `TxClient`, `decimal.js` for money, plain-English thrown `Error` messages, Sentry tenant context.
- **Validators** (`src/lib/validators/*.validators.ts`): Zod schemas mirroring each service.
- **API routes** (`src/app/api/store/.../route.ts`): `auth()` → session/tenant check → `hasPermission` → zod parse → service → `{ success, data, meta }` envelope; known error-message substrings map to HTTP codes.
- **External HTTP**: native `fetch` (no axios), `AbortController` timeouts, `X_SANDBOX === "true"` staging switches, lazy env reads, HMAC signatures.
- **Cron jobs**: `src/app/api/cron/*` bearer-guarded by `CRON_SECRET` using `timingSafeEqual`; services expose a `processPending*()` poll-and-process function (see appointment reminders).
- **Webhooks inbound**: PayHere IPN pattern — always return 200, verify signature, idempotency guard, store raw payload.

### 5.3 Frontend Patterns (ERP)
- Route group `(store)` holds the app; server pages do `auth()` → feature-guard (`isModuleEnabled`) → `hasPermission` → Prisma fetch → render a `*Client` component.
- shadcn/ui primitives (`src/components/ui/*`), AyurPOS brand palette (espresso/terracotta/sand/mist/linen/pearl), `lucide-react` icons, sonner toasts.
- Client state: **zustand** stores; **@tanstack/react-query** hooks for server data (`src/hooks/*`).
- Forms: `react-hook-form` + `standardSchemaResolver` + Zod.
- Sidebar nav is defined in `src/components/layout/StoreSidebar.tsx` as grouped nav items filtered by role/permission.

### 5.4 Website (Customer-Facing)
- Separate Next.js app; read-only public catalog via `apiFetch` against `NEXT_PUBLIC_API_BASE_URL`; ISR + cache tags + revalidate webhook.
- Cart is **client-side only** (zustand + localStorage), no checkout, no order backend, no payment, no tracking page.

---

## 6. Trans Express Capabilities vs. Required Bridges

The following table (from the architecture specification) frames what the API does vs. what our system must build. **The plan in this series covers all "System-Level Implementation Required" rows.**

| Operational Need | Trans Express API | What AyurPOS Must Build |
|---|---|---|
| User authentication | Native (login → bearer token) | Token store + refresh |
| Location master data (provinces/districts/cities) | Native | Sync into a local location table; seed; keep dropdowns aligned |
| Order creation (single/bulk) | Native | Dispatch service + waybill persistence |
| Manual waybill assignment | Native | Office entry of pre-printed waybills |
| Flexible city mapping (id or text) | Native (both accepted) | Resolve city id/text; store both on delivery |
| COD amount | Native (`cod`/`cod_amount`) | Capture COD at dispatch; reconciliation ledger |
| Single package tracking | Native (`/tracking` by waybill) | Scheduled poller + status mapping |
| **Rate pre-calculation** | **Not provided** | Local rate card + weight engine |
| **Weight/dimensions** | **Not accepted** | Record weight after hub weigh-in; store for reports |
| **Webhooks** | **Not provided** | Scheduled poller (no push) |
| **Edit/Cancel via API** | **Not provided** | Hold buffer + manual escalation pipeline |
| **Financial/COD ledger** | **Not provided** | Reconciliation ledger + CSV import |

---

## 7. High-Level Architecture

### 7.1 Conceptual Diagram

```
                      AYURPOS ERP
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│   (Store) Delivery Module            Delivery Service Layer   │
│   ├─ Dashboard (list/detail)         ├─ DispatchService       │
│   ├─ Dispatch workflow               ├─ TrackingService       │
│   ├─ Rate calculator UI              ├─ RateEngine            │
│   ├─ Shipping label printer          ├─ LocationSyncService   │
│   ├─ Packaging inventory             ├─ ReconciliationService │
│   └─ Failed-order recovery           └─ Courier Client (abstr.)│
│                 │                                │            │
└─────────────────┼────────────────────────────────┼────────────┘
                  │ REST (server-side)             │ REST
                  ▼                                ▼
      CUSTOMER-FACING WEBSITE              TRANSPORT ADAPTER
      ├─ Checkout (address + COD)          (Trans Express client,
      └─ Order tracking page                 staging/prod, auth,
                                             retries, mapping)
                                                       │
                                                       ▼
                                             TRANS EXPRESS API
                                             ├─ login/client
                                             ├─ orders/upload/*
                                             ├─ tracking
                                             └─ provinces/districts/cities
                                             │
                                       (no webhooks) ──► Scheduled Poller
                                                       (cron → TrackingService)
```

### 7.2 Key Architectural Decisions

1. **Carrier abstraction.** The ERP talks to a **transport adapter interface**, never directly to Trans Express. One concrete adapter (`TransExpressAdapter`) implements it. This makes adding Domex/PromptX/Koombiyo later a new adapter, not a rewrite.
2. **A delivery is the source of truth; a shipment is the carrier projection.** The internal `Delivery` model records the business truth (status pipeline, COD, address, attempts). The `CourierShipment` record holds carrier-specific identity (waybill, carrier order id, last synced status, raw responses). This decoupling isolates us from carrier API quirks.
3. **No webhooks → poll-and-process.** A cron-triggered `processDueTrackingChecks()` service polls all active (non-terminal) shipments in throttled batches, diffs statuses, and writes events + triggers notifications.
4. **Rate engine is local.** Shipping fees are computed from a per-tenant **rate card** (base + per-extra-kg, by zone) plus summed product weights — because Trans Express has no estimate endpoint and doesn't accept weight at creation.
5. **Hold-buffer before dispatch.** Newly created deliveries sit in a `PENDING_DISPATCH` state for a configurable window (30–60 min) to allow edits/cancels, since the API cannot edit/cancel after submission.
6. **Reconciliation is explicit.** Delivered + COD → ledger `PENDING_SETTLEMENT`. Portal CSV upload → matching engine. No automatic financial claims.
7. **Idempotency everywhere.** Dispatch calls carry a deterministic request id / order reference so retries never create duplicate waybills.

### 7.3 Multi-Tenant Isolation
- Every new model is tenant-scoped (`tenantId` + `Tenant` relation + index), matching the whole codebase.
- Carrier credentials are **per-tenant** (each tenant may connect their own Trans Express account).
- Rate cards are per-tenant.
- The scheduled poller iterates **all tenants' active shipments**, respecting each tenant's credentials.

---

## 8. Feature Toggle & Superadmin Control

Follow the established `feature-guard.ts` pattern.

- Extend `KNOWN_MODULES` with a new module name, e.g. `delivery` (and later `onlineCheckout`).
- Extend `MODULE_DEFINITIONS` with a human-readable toggle entry for the superadmin feature-modules manager.
- Store enablement in `Tenant.settings.enabledModules`.
- Guard:
  - **ERP delivery pages**: `isModuleEnabled(settings, 'delivery')` → redirect/404 if disabled.
  - **Delivery API routes**: return 403 if disabled.
  - **Sidebar**: hide the Delivery nav item when disabled.
  - **Website tracking/checkout**: only surface when the tenant has the module enabled **and** a courier account configured.

**Recommended module names (in order):**
- `delivery` — the courier/dispatch module (Phase 1).
- `onlineCheckout` — customer-facing website checkout + tracking (Phase 1/2; ties directly into delivery).

---

## 9. Permissions & RBAC Model

### 9.1 New `DELIVERY` permission group
Add a `DELIVERY: { ... }` block to `PERMISSIONS` in `src/lib/constants/permissions.ts`. The type machinery (`PermissionKey`, `ALL_PERMISSIONS`) and OWNER defaults update automatically. Suggested keys:

| Key | Value | Meaning |
|---|---|---|
| `viewDelivery` | `delivery:view` | View deliveries & shipments |
| `createDelivery` | `delivery:create` | Create a delivery / begin dispatch |
| `dispatchDelivery` | `delivery:dispatch` | Push to courier / issue waybill |
| `editDelivery` | `delivery:edit` | Edit address/COD while pending |
| `cancelDelivery` | `delivery:cancel` | Cancel before dispatch / after (escalation) |
| `trackDelivery` | `delivery:track` | View live status & history |
| `manageRateCard` | `delivery:ratecard:manage` | Configure shipping rate card |
| `manageCourierSettings` | `delivery:courier:manage` | Configure Trans Express account |
| `viewReconciliation` | `delivery:recon:view` | View COD ledger & reconciliation |
| `importRemittance` | `delivery:recon:import` | Upload courier remittance CSV |
| `managePackaging` | `delivery:packaging:manage` | Manage packaging inventory |
| `dispatchPackaging` | `delivery:packaging:dispatch` | Auto-deduction / manual packaging stock ops |
| `manageRecovery` | `delivery:recovery:manage` | Failed-order follow-up / redeliver / cancel |

### 9.2 Role assignment (initial)
- **OWNER / SUPER_ADMIN**: all delivery permissions.
- **MANAGER**: all delivery permissions except destructive/financial-sensitive ones (per existing managerExcluded pattern — e.g., exclude `manageCourierSettings`, `importRemittance` if desired).
- **NEW `DISPATCH_STAFF` role**: view + create + dispatch + track + packaging + recovery; **not** rate-card config, courier settings, or reconciliation (office operational role).
- **CASHIER / STOCK_CLERK**: none by default (grant explicitly if needed).
- Add delivery keys to `ROLE_PERMISSIONS` and to the curated role lists.

### 9.3 Notes
- Adding a new `UserRole` enum value (`DISPATCH_STAFF`) requires a Prisma migration; the staff-management UI, seed defaults, and any role-dropdowns must include it.
- Server is authoritative: pages and API routes enforce permissions regardless of UI visibility.

---

## 10. Folder & File Conventions (to Follow When Implementing)

All new files must follow the established modular layout. Full file inventory is in Part 5.

### 10.1 ERP — Backend
```
erp/src/lib/
  courier/                          # carrier adapter folder (mirrors billing/)
    types.ts                        # CourierProvider interface & shared types
    trans-express/
      client.ts                     # raw HTTP client (auth, base url, fetch)
      auth.ts                       # login + token store
      orders.ts                     # upload single/bulk mappers
      tracking.ts                   # /tracking call + mapping
      locations.ts                  # provinces/districts/cities sync
      mappers.ts                    # map internal delivery <-> API payload
      errors.ts                     # map API errors to typed results
  services/
    delivery.service.ts             # create/dispatch/edit/cancel deliveries
    shipment.service.ts             # waybill persistence, status diff
    tracking.service.ts             # processDueTrackingChecks() poller
    rate-engine.service.ts          # local shipping fee calculation
    location-sync.service.ts        # master location sync (monthly)
    packaging.service.ts            # packaging inventory + auto-deduction
    reconciliation.service.ts       # ledger + CSV matching
  validators/
    delivery.validators.ts
    shipment.validators.ts
    ratecard.validators.ts
    packaging.validators.ts
    reconciliation.validators.ts
  constants/
    courier.ts                      # base URLs, status enums, defaults
  utils/
    courier.ts                      # shared helpers (weight calc, city resolve)
src/app/api/
  store/deliveries/route.ts + [id]/route.ts
  store/shipments/[id]/track/route.ts
  store/delivery/ratecard/route.ts
  store/delivery/locations/route.ts
  store/packaging/route.ts + [id]/route.ts
  store/reconciliation/route.ts + import/route.ts
  cron/sync-locations/route.ts
  cron/sync-shipments/route.ts      # tracking poller
  cron/clear-held-deliveries/route.ts  # hold-buffer expiry
  webhooks/trans-express/route.ts   # reserved: future HMAC callback if supported
```

### 10.2 ERP — Frontend
```
erp/src/app/(store)/delivery/
  page.tsx                          # list (server, guarded)
  [deliveryId]/page.tsx             # detail (server, guarded)
  rate-card/page.tsx
  packaging/page.tsx
  reconciliation/page.tsx
erp/src/components/delivery/
  DeliveryPageClient.tsx
  delivery-list/  DeliveryTable.tsx, DeliveryFilters.tsx
  delivery-form/  CreateDeliverySheet.tsx, AddressFields.tsx, DispatchButton.tsx
  delivery-detail/ DeliveryDetailPanel.tsx, ShipmentStatusCard.tsx, StatusTimeline.tsx
  rate-card/      RateCardForm.tsx, RateMatrixTable.tsx
  packaging/      PackagingPageClient.tsx, PackagingStockTable.tsx
  reconciliation/ ReconciliationClient.tsx, RemittanceUpload.tsx, LedgerTable.tsx
  labels/         ShippingLabel.tsx, InvoiceLabel.tsx, DualBarcodeLabel.tsx
erp/src/stores/deliveryStore.ts
erp/src/hooks/useDeliveries.ts, useShipmentTracking.ts, useRateCard.ts, usePackaging.ts, useReconciliation.ts
```

### 10.3 Website
```
website/src/app/[tenantSlug]/
  checkout/page.tsx                 # address + COD/options (Phase 1/2)
  track-order/page.tsx              # public order tracking by order id / phone / waybill
website/src/lib/api/delivery.ts     # public POST endpoints (order placement, tracking lookup)
website/src/components/website/checkout/ ...
website/src/components/website/tracking/ ...
```

---

## 11. Cross-Cutting Concerns (Applies to All Parts)

- **Money**: always `decimal.js`; no floats for LKR amounts (COD, shipping fee, reconciliation).
- **Audit**: every dispatch, cancel, redeliver, rate-card change, packaging stock change, and reconciliation action writes an `AuditLog` entry.
- **Notifications**: status transitions and alerts create `NotificationRecord`s (new `NotificationType` values; see Part 5).
- **Errors**: services throw plain-English errors; routes map them to HTTP codes.
- **Sentry**: services call the tenant-context helper at entry.
- **Multi-tenancy**: every query scoped by `tenantId`.
- **Idempotency**: dispatch/import operations must be safe to retry.

---

## 12. Summary of Part 2 → Handoff

Part 2 (**Data Model & Schema Design**) defines the exact Prisma enums, models, relations, and indexes that implement this architecture, plus the migration strategy. Review Part 1's scope, architecture decisions, and permissions before proceeding.
