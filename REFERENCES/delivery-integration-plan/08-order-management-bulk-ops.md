# Delivery Feature — Order Management, Bulk Operations & Website Checkout

**Carrier:** Trans Express
**System:** AyurPOS (ERP + Website)
**Date:** 2026-08-06
**Status:** Planned — Not Yet Implemented
**Part of:** `REFERENCES/delivery-integration-plan/` (feature companion to Parts 1–5)

---

## 1. Purpose

This document specifies the **Order Management** workflow end-to-end: how a customer order placed on the public **website** is received and managed inside the **ERP**, processed through statuses, bulk-advanced, turned into delivery records, and bulk-printed. It covers both the **walk-in / phone** order path (entered or imported in the ERP) and the **online** path (placed on the website).

It is a **guidance/specification document only (no code snippets)**, matching the conventions of Parts 1–5. Implementation follows the established modular structure.

---

## 2. Goals & Non-Goals

### 2.1 Goals
- Give the ERP a dedicated **Orders management page** that aggregates pending sales orders (online + walk-in/phone) in one place.
- Let staff **process orders** (mark status: processing → handed to delivery, etc.) individually.
- Support **bulk status changes** on multiple selected orders at once.
- Support **bulk delivery creation** from selected orders **without** visiting the delivery page.
- Support **bulk label printing** for multiple orders at once.
- Provide a **website checkout** that creates orders flowing into the ERP order page.

### 2.2 Non-Goals
- No separate e-commerce `Order` table — orders **are** `Delivery` records with `source = WEBSITE_CHECKOUT` (per Part 2 §2.1 and the chosen architecture). This keeps one source of truth and reuses the delivery/dispatch/courier pipeline.
- No payment gateway integration (COD + manual/credit processing only in this iteration). Website checkout is **COD / contact-store** based.
- No customer-facing order tracking page in this iteration (deferred; Part 4 already scopes `track-order`).
- No partial-shipment splitting in bulk operations (one delivery per order).

---

## 3. Current State (Baseline)

| Area | Status |
|---|---|
| Website cart | Exists (`website/src/stores/cartStore.ts`) but **no checkout** — "Place Order" links back to the cart; no order is created. |
| Website → ERP communication | HTTP **read-only** only (catalog/config fetches). No shared DB, no order-placement endpoint. |
| ERP Orders page | **Missing.** No `/orders` route or nav item. Closest is `/sales` (POS sale history). |
| Order data model | **No `Order` model.** Website/online orders are intended to be `Delivery` records (`DeliverySource.WEBSITE_CHECKOUT` exists in the enum but is unused). |
| Delivery creation | **Single-only.** `POST /api/store/deliveries` → `createDelivery` creates one delivery in a transaction. |
| Bulk operations | **None.** No checkbox/selection/bulk/batch code in `erp/src`. |
| Label printing | **Single-only** (`printShippingLabel(delivery, template)` per row). |

---

## 4. Requirements

### 4.1 Website checkout
- A **checkout page** on the website with an address form (name, phones, address lines, city, district, postal code) and a COD summary (items, totals).
- **No login required** — guest checkout.
- On submit, calls a **public order-placement endpoint** on the ERP that creates a `Delivery` (`source = WEBSITE_CHECKOUT`, `status = PLACED`) with a `ShippingAddress` snapshot.
- **Order confirmation** screen with the generated order reference.
- Basic **validation**: required name/phone/address/city; phone format; order items non-empty.

### 4.2 ERP order management
- A dedicated **Orders page** (`/orders`) listing orders (deliveries with `source` in `WEBSITE_CHECKOUT`/`ERP_MANUAL`/`POS`), with search + status filter.
- Columns: select checkbox, order ref, customer, phone, city, item count, COD, status, created date.
- **Per-row actions**: view, print label, open dispatch.

### 4.3 Order processing statuses
Reuse the existing `DeliveryStatus` pipeline as the unified order status:
`PLACED` (order received) → `PROCESSING`/`PENDING_DISPATCH` (being prepared) → `DISPATCHED` (handed to delivery) → `IN_TRANSIT` → `DELIVERED` | `CANCELED` | `RETURNED`.

### 4.4 Bulk operations (multi-select)
- **Bulk status change**: select one/more orders, choose a target status, apply to all in one request.
- **Bulk create delivery record**: select one/more orders and advance them into the dispatch-ready state (`PENDING_DISPATCH`) in bulk — this is the "make a delivery record without visiting /delivery" step. It is idempotent (already-dispatchable orders are skipped or reported).
- **Bulk print labels**: select one/more orders and open a single print window with all their labels.

### 4.5 Guards (RBAC)
- View orders: `DELIVERY.viewDelivery`.
- Process / bulk status change: `DELIVERY.editDelivery`.
- Bulk create delivery / dispatch: `DELIVERY.dispatchDelivery`.
- Bulk print: any user who can view orders.

---

## 5. Data Model

**No schema migration is required.**

- Orders are **`Delivery` records** (existing model). `source = WEBSITE_CHECKOUT` marks online orders; `status = PLACED` marks them as newly received.
- The website checkout creates a `Delivery` + `ShippingAddress` using the **same** `createDelivery` service path already used by the ERP, with `source = WEBSITE_CHECKOUT` and an initial status of `PLACED`.
- Existing `DeliveryStatus` values already cover the required order lifecycle, so no new enums/columns.

---

## 6. API & Service Layer

### 6.1 Public (website → ERP) — no auth, tenant-scoped by slug
| Route | Method | Purpose |
|---|---|---|
| `POST /api/public/site/[tenantSlug]/orders` | POST | Create a `Delivery` (`source = WEBSITE_CHECKOUT`) + `ShippingAddress` from checkout payload. Returns `{ orderRef, deliveryId }`. |

- **Throttling/guard:** basic shape validation, COD amount clamp, item count bounds. No PII beyond the order itself.
- **Rate limiting / abuse:** rely on the existing public-site guard (`isModuleEnabled`/tenant resolution); optionally require a lightweight honeypot field.

### 6.2 ERP internal
| Route | Method | Purpose | Guard |
|---|---|---|---|
| `GET /api/store/orders` | GET | List order deliveries with filters/search | `viewDelivery` |
| `POST /api/store/orders/bulk-status` | POST | Bulk update `Delivery.status` for given ids | `editDelivery` |
| `POST /api/store/orders/bulk-create-delivery` | POST | Bulk advance selected orders to dispatch-ready | `dispatchDelivery` |

- **Bulk status:** transaction that updates status + writes a `DeliveryEvent` per delivery + audit.
- **Bulk create delivery:** for each selected delivery still in a pre-dispatch state, set status to `PENDING_DISPATCH`, write an event + audit. Returns per-id results so the UI can report successes/skips.
- **Bulk print labels** is a **client-side** operation (no API) — collect the selected deliveries' label props and render them all in one print overlay.

---

## 7. UI & Component Breakdown (Modular)

### 7.1 ERP — new `orders` feature, mirroring the `delivery/` folder pattern
| Component | Path | Purpose |
|---|---|---|
| `OrdersPage` (server) | `src/app/(store)/orders/page.tsx` | Guard + module check → render client |
| `OrdersPageClient` | `src/app/(store)/orders/OrdersPageClient.tsx` | Filters, selection state, bulk toolbar, list |
| `OrdersTable` | `src/components/orders/OrdersTable.tsx` | Table with selectable checkboxes + row actions |
| `OrderStatusBadge` | `src/components/orders/OrderStatusBadge.tsx` | Reuse delivery status colors |
| `BulkActionBar` | `src/components/orders/BulkActionBar.tsx` | Bulk status change, bulk create delivery, bulk print (enabled when selection > 0) |
| `BulkStatusDialog` | `src/components/orders/BulkStatusDialog.tsx` | Choose target status for selected orders |
| `OrderFilters` | `src/components/orders/OrderFilters.tsx` | Search + status filter (reuse pattern) |

### 7.2 ERP — hooks
- `useOrders` (`src/hooks/orders/useOrders.ts`) — fetch list, exposes `data`, `isLoading`.
- `useBulkStatusChange` — POST bulk-status.
- `useBulkCreateDelivery` — POST bulk-create-delivery.

### 7.3 Website — new `checkout` feature
| Component | Path | Purpose |
|---|---|---|
| `checkout/page.tsx` | `website/src/app/[tenantSlug]/checkout/page.tsx` | Checkout page |
| `CheckoutForm` | `website/src/components/checkout/CheckoutForm.tsx` | Address + COD review + submit |
| `CheckoutSummary` | `website/src/components/checkout/CheckoutSummary.tsx` | Items/totals review |
| `OrderConfirmation` | `website/src/components/checkout/OrderConfirmation.tsx` | Post-submit confirmation |
| `api/delivery.ts` | `website/src/lib/api/delivery.ts` | `placeOrder(...)` client using `NEXT_PUBLIC_API_BASE_URL` |
| `address.validators.ts` | `website/src/lib/validators/address.ts` | Shared address schema |

### 7.4 Bulk label printing (ERP)
- New helper `printShippingLabels(deliveries, template)` in `src/components/delivery/labels/` that reuses the existing print-overlay logic to render **all** labels stacked (one per order) and opens one print dialog.
- The bulk print action in `BulkActionBar` calls it with the selected orders' label props.

---

## 8. RBAC & Permissions

Reuse existing delivery permissions (no new ones):

| Action | Permission |
|---|---|
| View orders | `DELIVERY.viewDelivery` |
| Edit / bulk status | `DELIVERY.editDelivery` |
| Bulk create delivery / dispatch | `DELIVERY.dispatchDelivery` |
| Bulk print | `DELIVERY.viewDelivery` |

- Add an **"Orders"** nav entry under a top-level group (or under Delivery) in `StoreSidebar.tsx`, guarded by `viewDelivery`.

---

## 9. Integration with Existing Flow

- **Website checkout** creates a `Delivery` via the public endpoint → appears immediately in the ERP **Orders** page (source `WEBSITE_CHECKOUT`).
- **Processing** changes `Delivery.status`; **handed to delivery** = `DISPATCHED` (optionally via the existing dispatch flow for courier shipment).
- **Bulk create delivery** reuses the delivery pipeline state machine — it does not duplicate the `Delivery` record; it advances the order's delivery into the dispatch-ready state.
- **Bulk print** reuses the existing label template (`useLabelTemplate`) and print overlay so labels honor the tenant's saved design.

---

## 10. Validation & Error Handling

- **Checkout payload:** zod schema (name/phone/address/city required; phone pattern; itemCount ≥ 1; COD non-negative; lengths capped). Errors returned as `VALIDATION_ERROR`.
- **Bulk status:** validate the target status against allowed transitions; reject invalid transitions (e.g., `DELIVERED` → `PLACED`).
- **Bulk create delivery:** skip already-dispatchable orders; report per-id outcome so the UI can toast successes and skips.
- **Unknown tenant slug:** 404 on the public endpoint.
- **Audit:** `DELIVERY_STATUS_CHANGED` / `DELIVERY_CREATED` logs for bulk operations.

---

## 11. Acceptance Criteria

1. A customer can place an order on the website (guest checkout, COD) and sees a confirmation with an order reference.
2. The order appears in the ERP **Orders** page with `source = WEBSITE_CHECKOUT`.
3. Staff can change a single order's status and see it reflected.
4. Staff can select multiple orders and change their status in one action.
5. Staff can select multiple orders and bulk-create delivery records (advance to dispatch-ready) without visiting `/delivery`.
6. Staff can select multiple orders and print all their labels in one print window, honoring the saved label design.
7. Walk-in/phone orders can also be represented (via manual entry or `WEBSITE_CHECKOUT`-style creation) and appear on the same page.
8. Permission-guarded: non-authorized roles cannot view/process/print.
9. No schema migration required; type-check and production build pass.

---

## 12. Implementation Roadmap

| Phase | Scope |
|---|---|
| **1 — ERP Orders module** | `orders` route + nav, `OrdersPageClient`, `OrdersTable` (with selection), `useOrders` hook, filters |
| **2 — Bulk operations** | `BulkActionBar`, `BulkStatusDialog`, `useBulkStatusChange`, bulk-status API; `useBulkCreateDelivery` + bulk-create API; per-id result reporting |
| **3 — Bulk print** | `printShippingLabels(deliveries, template)` + wire into bulk bar |
| **4 — Website checkout** | public order-placement endpoint, website `checkout` page, `api/delivery.ts`, address validation, confirmation screen |
| **5 — Hardening** | audit wiring, transition validation, RBAC check, seed a sample `WEBSITE_CHECKOUT` order for demo, build/typecheck verification |

---

## 13. File Inventory (New / Modified)

**New — ERP**
- `src/app/(store)/orders/page.tsx`
- `src/app/(store)/orders/OrdersPageClient.tsx`
- `src/components/orders/OrdersTable.tsx`
- `src/components/orders/OrderStatusBadge.tsx`
- `src/components/orders/BulkActionBar.tsx`
- `src/components/orders/BulkStatusDialog.tsx`
- `src/components/orders/OrderFilters.tsx`
- `src/hooks/orders/useOrders.ts`
- `src/hooks/orders/useBulkStatusChange.ts`
- `src/hooks/orders/useBulkCreateDelivery.ts`
- `src/app/api/store/orders/route.ts` (GET list)
- `src/app/api/store/orders/bulk-status/route.ts`
- `src/app/api/store/orders/bulk-create-delivery/route.ts`
- `src/components/delivery/labels/printShippingLabels.ts` (bulk)

**New — Website**
- `website/src/app/[tenantSlug]/checkout/page.tsx`
- `website/src/components/checkout/CheckoutForm.tsx`
- `website/src/components/checkout/CheckoutSummary.tsx`
- `website/src/components/checkout/OrderConfirmation.tsx`
- `website/src/lib/api/delivery.ts`
- `website/src/lib/validators/address.ts`

**Modified — ERP**
- `src/components/layout/StoreSidebar.tsx` (Orders nav entry)
- `src/lib/validators/order.validators.ts` (new) — checkout/bulk payload schemas
- `src/lib/services/order.service.ts` (new) — bulk status + bulk create delivery
- `src/lib/services/audit.service.ts` (reuse existing actions)

**Modified — Website**
- `website/src/lib/api/client.ts` (extend fetch helper for POST, if needed)
- `website/src/stores/cartStore.ts` (expose items + clear after order placed)

**No changes**
- `prisma/schema.prisma` (no migration — orders are `Delivery` records)
- Courier/trans-express adapter, rate, packaging, reconciliation modules
