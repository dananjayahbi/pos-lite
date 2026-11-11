# Delivery & courier module

The delivery module turns an order into a tracked parcel: create → dispatch →
carrier tracking → delivered/failed → recovery, with packaging stock, COD
reconciliation and a customer tracking page. This document is the operator and
developer reference for the ERP side (`erp/`). The storefront tracking page lives
in the separate `website/` app.

## Pages and permissions

| Page | Permission | Notes |
| --- | --- | --- |
| `/delivery` | `delivery:view` | List/search/status filter; manual create, dispatch, cancel |
| `/delivery/[id]` | `delivery:view` | Timeline, shipment/tracking, invoice/label, recovery |
| `/delivery/packaging` | `delivery:packaging:manage` | Items, categories, stock adjustments |
| `/delivery/settings` | `delivery:courier:manage` | Trans Express account + location sync |
| `/delivery/rate-card` | `delivery:ratecard:manage` | Base rate and zone overrides |
| `/delivery/label` | `delivery:label:manage` | Shipping-label template designer |
| `/delivery/reconciliation` | `delivery:recon:view` | COD ledger, remittance import, disputes |
| `/orders` | `delivery:view` | Order list + bulk prepare/status/labels/invoices |

All pages and APIs require the `delivery` feature module
(`Tenant.settings.enabledModules`). OWNER has every delivery permission;
MANAGER has all except courier settings, rate card and remittance import;
DISPATCH_STAFF has day-to-day delivery, packaging and recovery permissions.

## Lifecycle and status rules

```
website checkout ──> PLACED ──prepare──> PENDING_DISPATCH ──dispatch──> DISPATCHED
manual create ─────────────────────────> PENDING_DISPATCH              │
                                                                       ▼
                                      DELIVERED / FAILED / RETURNED <── tracking
                                                    │
                                      recovery (call/reschedule/redeliver/cancel)
```

- Forward statuses cannot regress. A late `submitted` carrier poll never moves a
  `DISPATCHED` parcel back to `PENDING_DISPATCH` (`isDeliveryStatusAdvance`).
- `DELIVERED`, `CANCELED` and `RETURNED` are terminal for tracking.
- `FAILED` and `RETURNED` are the recoverable states. Follow-up calls and
  reschedules keep the current status and add a timeline note; redelivery
  re-pushes the parcel and permanent cancel closes it.
- Bulk status changes in `/orders` use the same rules. `CANCELED` is routed
  through the cancellation service (restock + ledger reversal); `DELIVERED`
  sets `deliveredAt` and creates the COD receivable; carrier-driven statuses
  require a shipment; terminal or backwards transitions are rejected.

## Manual delivery creation

The create sheet accepts a recipient, phone, address, city, COD, item count and
weight. City options come from `GET /api/store/delivery/locations`:

- When Trans Express locations have been synced, the cached master cities are
  used (numeric city IDs feed zone rates).
- When no cache exists, a curated Sri Lankan city list is returned with
  `source: FALLBACK`. The delivery is still created with the text city name and
  the rate card's default rate.
- The endpoint requires `delivery:create`, so DISPATCH_STAFF can create
  deliveries without courier-settings access.

Order references are allocated atomically from `OrderRefCounter` (`DEL-YYYY-NNNNNN`),
so concurrent creates cannot collide. Caller-supplied `customerId`/`saleId` are
validated against the tenant before being linked.

## Dispatch

Dispatch requires an active `CourierAccount`, a shipping address, a
`PENDING_DISPATCH` status and no active shipment. CARD orders must be `PAID`
(COD is unpaid by design). On success the module writes the courier shipment,
sets `DISPATCHED`, records the timeline event/audit and deducts packaging stock
in the same transaction.

The seeded staging account has deliberately fake credentials, so dispatch fails
with **“Trans Express authentication failed”** until real credentials are saved
in **Courier Settings & Rates**. The settings page also has **Sync locations
now**; run it once after saving credentials.

A card checkout placed while PayHere is not configured is automatically
switched to COD, so it is never left in an undispatchable `CARD`/`PENDING` state.

## Tracking and scheduled jobs

Tracking is pull-based. The cron routes are protected by `CRON_SECRET`:

| Cron | Schedule | Purpose |
| --- | --- | --- |
| `/api/cron/sync-shipments` | every 2 hours | Poll active shipments, update delivery status/events, create the COD ledger on delivery |
| `/api/cron/clear-held-deliveries` | hourly | Notify staff once when a `PENDING_DISPATCH` hold window expires |
| `/api/cron/sync-locations` | monthly | Refresh Trans Express province/district/city master data |

These schedules are declared in `erp/vercel.json`. On Vercel Hobby (daily-only
crons) run them from an external scheduler instead, using the same secret.
Configure the secret in the hosting environment.

Tracking effects:

- Every history row is mapped on its own, so the timeline shows the status that
  actually happened at that time.
- A late/out-of-order poll cannot regress the delivery.
- `DELIVERED` creates a `PENDING_SETTLEMENT` ledger entry only for unpaid COD
  parcels with a positive COD amount. Card orders no longer inflate COD aging.
- `RETURNED` clears/reverses the receivable and returns the parcel to recovery.
- Public tracking (`/{tenantSlug}/track`) only exposes carrier remarks and
  requires a full (9+ digit) phone number, preventing timeline-note leaks and
  short-prefix enumeration.

## Cancellation and recovery

- **Standard cancel** (`POST /api/store/deliveries/:id/cancel`) is only valid
  before dispatch. It is idempotent: a second call returns the already-cancelled
  delivery without restocking again. The status transition is claimed with a
  conditional update, so concurrent calls cannot double-restock. Website
  `DeliveryLine` stock is returned and any receivable is reversed.
- **Recovery** actions are available for `FAILED`/`RETURNED` deliveries:
  follow-up call, reschedule, redeliver and permanent cancel.
- **Redelivery** supersedes the previous shipment (marks it `CANCELED` /
  `SUPERSEDED_BY_REDELIVERY`) before creating the new one. A delivery can have
  multiple shipment attempts; the newest is shown in the UI and only active
  shipments are polled.
- **Permanent cancel** restocks both sale-linked and website `DeliveryLine`
  stock, reverses packaging consumption and clears the COD receivable. It uses
  a conditional status claim, so it cannot run twice.

## Invoices and labels

- Website invoices now render the stored `DeliveryLine` snapshots (product, SKU,
  quantity, unit price, line total) and include the shipping fee in the grand
  total. Sale-linked invoices continue to use `Sale.totalAmount`.
- Labels are printed through the browser (`window.print()`); the label designer
  saves branding, fields and page-size preferences. Page size and the
  origin/pickup toggles currently affect the sample preview only — real labels
  use the standard 80 mm layout.

## COD reconciliation

`ReconciliationLedgerEntry` is the expected-receivables ledger. Entries are
created when a COD parcel becomes `DELIVERED` (tracking or bulk status), and are
cleared/reversed on cancel/return. Remittances are imported as CSV/XLSX with
`waybill, amount, fees, status, date`; rows match by waybill → order ref →
barcode. Disputes are one per ledger entry (a second open attempt returns 409).

## Test data and local checks

- `tests/24_delivery_courier.spec.ts` covers delivery create/list/patch/
  dispatch/track/cancel, settings redaction and RBAC.
- `tests/25_rate_cards.spec.ts` covers rate cards and the public shipping quote.
- `tests/26_courier_reconciliation.spec.ts` covers reconciliation read-only
  surfaces, import validation and disputes.
- Unit tests live under `src/lib/courier/__tests__`,
  `src/lib/services/__tests__`, and `src/lib/tracking/__tests__`.

## Known limitations

The module still does not post website revenue/COD receipts to payment accounts,
expense courier fees, emit delivery webhooks, or send customer failure/delivery
notifications. These are product-accounting integrations rather than delivery
pipeline blockers; see the references under `REFERENCES/delivery-integration-plan/`.
Label page-size/origin rendering and the customer `Delivery.customerId` link for
website orders are also follow-ups.
