# Delivery Integration Plan — Part 3 of 5: Courier Integration Layer (Trans Express API)

**Carrier:** Trans Express
**System:** AyurPOS (ERP)
**Date:** 2026-08-06
**Status:** Planned — Not Yet Implemented

---

## 1. Purpose

This document is the implementation guide for the **transport adapter** that connects AyurPOS to the Trans Express API. It covers authentication, endpoint selection, field mapping, error handling, idempotency, retries, the tracking poller, location sync, and the local rate engine. It references the **official API documentation** for exact payloads; here we focus on how our system uses each endpoint and how the adapter must behave.

---

## 2. Environments & Base URLs

The adapter must resolve base URLs from configuration. Mirror the existing `X_SANDBOX === "true"` convention used by PayHere.

| Env | API Base URL | Usage |
|---|---|---|
| Staging | `https://dev-transexpress.parallaxtec.com/api` | Development/testing (`CourierEnv.STAGING`) |
| Production | `https://portal.transexpress.lk/api` | Live accounts (`CourierEnv.PRODUCTION`) |

- The per-tenant `CourierAccount.env` selects the base URL.
- Env variables provide **defaults/fallbacks** and any platform-level override (e.g., `TRANSEXPRESS_BASE_URL_STAGING`, `TRANSEXPRESS_BASE_URL_PROD`), but the per-tenant account is authoritative.

---

## 3. Authentication

### 3.1 Login
- **Endpoint:** `POST /login/client`
- **Request body:** `{ "email", "password" }`
- **Response:** `{ "token", "status": "success" }`
- The `token` is used as a **Bearer token** (`Authorization: Bearer <token>`) on all subsequent calls.
- **Production note (from docs):** obtain a long-lived **API key** from Client Portal → My Profile → Update Account → API Key and send it as the Bearer token. Prefer this for production.

### 3.2 Token handling in the adapter
- On configuration save or login, the system calls `/login/client` with the tenant's stored email/password (staging) **or** uses the stored long-lived API key (production).
- Cache the bearer token per `CourierAccount` (in memory / short TTL), refresh when a call returns `401`.
- **Never** log the token or return it in any API response.
- Store credentials per the security guidance in Part 2 (§3.5).

---

## 4. Endpoint Inventory & When to Use Each

The official docs define eight upload endpoints plus tracking and location lookups. The adapter must pick the correct variant based on **waybill mode** (manual vs auto) and **city identifier availability** (numeric `city_id` vs plain `city` text).

### 4.1 Order upload matrix

| Needs | Waybill mode | City input | Endpoint |
|---|---|---|---|
| Single | Manual | city_id | `POST /orders/upload/single-manual` |
| Single | Auto | city_id | `POST /orders/upload/single-auto` |
| Single | Auto | city text | `POST /orders/upload/single-auto-without-city` |
| Single | Manual | city text | `POST /orders/upload/single-manual-without-city` |
| Bulk | Auto | city_id | `POST /orders/upload/auto` |
| Bulk | Manual | city_id | `POST /orders/upload/manual` |
| Bulk | Auto | city text | `POST /orders/upload/auto-without-city` |
| Bulk | Manual | city text | `POST /orders/upload/manual-without-city` (docs list URL as `auto-without-city` — treat as manual-without-city variant; verify at integration time) |

### 4.2 Field naming differences (critical)
The single-order and bulk-order endpoints use **different field names**:

| Concept | Single-order endpoints | Bulk endpoints |
|---|---|---|
| Waybill | `waybill_id` | `way_bill` |
| Order ref | `order_no` | `order_id` |
| Customer | `customer_name` | `customer_name` |
| Address | `address` | `address` |
| Description | `description` | `order_description` |
| Phone | `phone_no` | `customer_phone` |
| Phone 2 | `phone_no2` | `customer_phone2` |
| COD | `cod` | `cod_amount` |
| City id | `city_id` | `city` (int for with-city) |
| City text | `city` (without-city variants) | `city` (string for without-city) |
| Note | `note` | `remark(s)` |

The **mapper layer** must produce the correct shape per endpoint. This is isolated in the adapter's mapper functions so the rest of the system stays agnostic.

### 4.3 Tracking
- **Endpoint:** `POST /tracking`
- **Request body:** `{ "waybill_id": "<8-char>" }`
- **Response (`data`):** `waybill_id`, `order_no`, `customer_name`, `customer_address`, `customer_district`, `customer_city`, `customer_phone_no`, `weight`, `placed_date`, `completed_date`, `current_status`, `status_history[]` (each with `name`, `remarks`, `added_date`).

### 4.4 Location master data
- **Provinces:** `GET /provinces`
- **Districts:** `GET /districts?province_id=<id>`
- **Cities:** `GET /cities?district_id=<id>`
- Responses for districts/cities are arrays of `{ id, text }`.
- These feed the **location sync** service (see §7) and populate checkout/delivery dropdowns.

---

## 5. Request/Response Mapping

### 5.1 Internal `Delivery` → Trans Express payload
Mappings (conceptual; exact field names per §4.2):
- `order_no`/`order_id` ← `CourierShipment`/`Delivery.orderRef` (or `courierOrderRef`).
- `customer_name` ← `ShippingAddress.fullName`.
- `address` ← concatenated `ShippingAddress.addressLine1 (+ line2)`.
- `phone_no`/`customer_phone` ← normalized `ShippingAddress.phone` (E.164; Sri Lanka `+94` / leading `0` — reuse existing `formatPhoneNumber` helper).
- `phone_no2`/`customer_phone2` ← `ShippingAddress.phone2`.
- `cod`/`cod_amount` ← `Delivery.codAmount`.
- `city_id` (int) or `city` (text) ← `ShippingAddress.cityId` or `cityName`.
- `district_id` (optional where supported) ← `ShippingAddress.districtId`.
- `description`/`order_description` ← item summary / notes.
- `note`/`remark(s)` ← `Delivery.notes`.

### 5.2 Trans Express response → internal model
On successful upload:
- Single-order success returns `{ "success", "order": { waybill_id, order_no, ..., id, client_id, status_id, ... } }`.
- Bulk success returns `{ "success", "orders": [ { waybill_id, id, status_id, ... } ] }`.
- Persist `waybill_id` on `CourierShipment`, plus `courierOrderId` (`id`) and initial `status_id`/raw status.
- **`status_id` is opaque** to us; map the macro status string (from tracking) rather than guessing from `status_id`.

On tracking:
- Map `current_status` string → `ShipmentStatus` enum via a lookup table (see §5.3).
- Store the full `status_history[]` into `DeliveryEvent` rows (dedup by `name`+`added_date`), preserving `remarks` and `added_date`.
- Capture `weight` (hub weigh-in) into `Delivery.hubWeightKg`.
- Capture `completed_date` and `customer_district`/`customer_city` as denormalized data.

### 5.3 Carrier status → internal status mapping
Maintain a mapping from Trans Express status strings (e.g., `Processing`, `In Transit`, `Out for Delivery`, `Delivered`, `Canceled`, `Returned`, `Failed`) to the internal `ShipmentStatus` and derived `DeliveryStatus`. Unknown strings should be stored raw and default to a generic `IN_TRANSIT`/`PROCESSING` rather than erroring. Define the mapping table in a constants file (Part 1 §10.1 `constants/courier.ts`) so it is easy to extend as Trans Express adds statuses.

---

## 6. Error Handling, Retries & Idempotency

### 6.1 Adapter error model
- Adapter calls return a **typed result** (`{ ok, data | error }`) — never throw for expected API failures.
- Classify errors: `AUTH` (401 → refresh token and retry once), `VALIDATION` (400 → capture details, flag delivery), `RATE_LIMIT`/`THROTTLE` (→ exponential backoff), `NETWORK`/timeout (→ retry), `UNKNOWN` (→ log + surface).

### 6.2 Timeouts
- Use `AbortController` + `setTimeout` for every outbound call (matching existing patterns). Suggested: 15s for uploads, 10s for tracking, 15s for login.

### 6.3 Retries
- Network/timeout/5xx: retry with backoff (e.g., 3 attempts; 1s/3s/9s) — the existing webhook `dispatch.ts` notes this as a known gap to improve; implement proper backoff here.
- Auth (401): refresh token, retry once.
- Validation (4xx): **no automatic retry** — persist the failure and alert staff.
- **Idempotency:** because Trans Express has no idempotency key, use our own guard: only dispatch a delivery whose `status = PENDING_DISPATCH` and that has no active `CourierShipment`. A per-tenant unique `waybillId` (Part 2 §7) plus a transactional check prevents duplicate waybills. Re-running dispatch for an already-dispatched delivery is a no-op.

---

## 7. Location Sync Service

- **Frequency:** monthly background job (cron), plus manual "Sync now" from the delivery settings UI.
- **Process:** `GET /provinces` → for each province `GET /districts?province_id=` → for each district `GET /cities?district_id=`.
- **Storage:** cache the hierarchy locally (a lightweight `Location` table keyed by Trans Express ids, or cached JSON on `CourierAccount`). Used to populate checkout/delivery dropdowns and to resolve text city → city_id.
- **Tolerance:** if a district/city lookup fails, keep last-known data; log and continue.
- Provide a **city resolver** helper: given a text city name, find the best `city_id` (exact, then case-insensitive, then fuzzy). This powers the "without-city" fallback endpoints and address normalization.

---

## 8. Tracking Poller (Webhook Substitute)

Trans Express provides **no webhooks**, so status must be polled.

### 8.1 Trigger
A cron route (`api/cron/sync-shipments`) guarded by `CRON_SECRET` calls `processDueTrackingChecks()`.

### 8.2 Selection
- Query all `CourierShipment` where `status` is **non-terminal** (not `DELIVERED`, `CANCELED`, `RETURNED`).
- **Throttle** per tenant (avoid hammering): process in bounded batches (e.g., 20–50 per run per tenant), and respect a configurable interval (docs suggest polling every 2–4 hours during business hours). Enforce a minimum gap since `carrierLastSyncedAt` per shipment.

### 8.3 Diff & commit
For each waybill:
1. Call `POST /tracking`.
2. Compare returned `current_status` + `status_history` against the stored `ShipmentStatus` and latest `DeliveryEvent`.
3. If changed:
   - Update `CourierShipment.status`, `rawStatus`, `carrierLastSyncedAt`, `latestEventAt`.
   - Insert new `DeliveryEvent` rows (deduped).
   - Update `Delivery.status` per the mapping (§5.3).
   - Set `Delivery.hubWeightKg` when `weight` appears.
   - **Trigger side effects** (non-blocking): notifications, and if `DELIVERED` → create/update `ReconciliationLedgerEntry` as `PENDING_SETTLEMENT` (Part 5).
4. If no change, just update `carrierLastSyncedAt`.

### 8.4 Idempotency & safety
- Each waybill processed at most once per run (transactional claim or in-memory batch dedup).
- Failures for individual waybills are logged and don't block the batch.
- Terminal shipments are skipped and can be filtered from the scan for efficiency.

---

## 9. Local Rate Engine (Shipping Fee Calculation)

Since Trans Express has no rate-estimation endpoint and doesn't accept weight at creation, AyurPOS computes fees locally.

### 9.1 Inputs
- Destination `cityId`/`districtId` (from `ShippingAddress`).
- Parcel total weight: sum of `weight × quantity` per item (product variant weight attributes — see Part 4 for adding weight to catalog).
- Active `RateCard` + matching `RateCardEntry` (origin → destination).

### 9.2 Calculation rules (per the architecture spec)
- `Shipping Fee = baseRate` when `W ≤ freeBaseWeightKg`.
- Else `Shipping Fee = baseRate + ceil(W − freeBaseWeightKg) × extraKgRate`.
- Apply the zone-specific `RateCardEntry` overrides when present (city-level > district-level > card default).
- Compute **net payout** for reconciliation: `Net = GrossCOD − (deliveryFee + COD commission % + VAT %)` (used in Part 5).
- Round to 2 decimals with `decimal.js`; never float.

### 9.3 When it runs
- At checkout (website) to show the shipping fee and on the final order total.
- In the ERP delivery-create form to preview the fee.
- Fee is stored on the `Delivery` and surfaced in reports.

---

## 10. Website Integration Points (Server-Side Only)

- The website cannot hold credentials. It calls **ERP public/authenticated endpoints** (or the ERP proxies on its behalf).
- **Checkout:** website collects address + COD and posts to an ERP route that creates a `Delivery` (source `WEBSITE_CHECKOUT`) in `PLACED`/`PENDING_DISPATCH`. The ERP computes the shipping fee server-side (never trust client-computed fees).
- **Tracking:** the public tracking page posts an `order_ref` / phone / waybill to an ERP endpoint that returns the masked status timeline (never expose internal fields, notes, or other customers' data).
- **Address normalization:** the checkout city dropdown is populated from the **synced location data** (from Part 3 §7) exposed via a public endpoint, so customers select a valid `city_id`.

---

## 11. Security & Operational Guardrails

- Bearer tokens and credentials: encrypted at rest, read server-side only, never serialized to clients, never logged.
- Validate all inbound public endpoints (checkout/tracking) with strict Zod schemas and rate-limit them (existing `rate-limit.ts`).
- Do not expose `CourierShipment.lastRawResponse` or raw payloads to non-admin roles.
- All outbound calls go through the adapter; no service calls Trans Express directly.
- Add Sentry tenant context in adapter/service entry points for diagnosability.

---

## 12. Summary → Part 4

Part 4 (**UI, Workflows & User Experience**) covers the ERP delivery dashboard and the dispatch workflow that drives this adapter: creating deliveries, the hold buffer, dispatching, printing shipping labels with dual barcodes, packaging auto-deduction, failed-order recovery, and the customer-facing checkout + tracking pages.
