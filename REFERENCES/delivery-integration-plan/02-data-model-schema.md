# Delivery Integration Plan — Part 2 of 5: Data Model & Schema Design

**Carrier:** Trans Express
**System:** AyurPOS (ERP)
**Date:** 2026-08-06
**Status:** Planned — Not Yet Implemented

---

## 1. Purpose

This document specifies every **new enum, model, relation, and index** needed to support the delivery/courier integration described in Part 1. It follows the existing Prisma conventions exactly:

- Enums declared in the `// ── Enums ──` section near the top of `prisma/schema.prisma`.
- Every tenant-scoped model has `id String @id @default(cuid())`, `tenantId String`, a `tenant Tenant @relation(...)`, `createdAt`, `updatedAt`, and (where needed) soft-delete `deletedAt`.
- Back-relations are added to the `Tenant` model.
- Indexes: every owned model gets `@@index([tenantId])` plus composite indexes for hot query paths.
- Postgres datasource; columns camelCase; tables snake-cased via `@@map`.
- Money is `Decimal @db.Decimal(12, 2)` (LKR).
- One migration per feature bundle, named `YYYYMMDDHHSSSS_add_<snake>_models`.

No code appears in this document — it is a specification of fields and behavior. The implementer translates these tables into Prisma models.

---

## 2. New Enums

### 2.1 `DeliverySource`
Where the delivery originated.
`WEBSITE_CHECKOUT` | `ERP_MANUAL` | `POS` | `IMPORT`

### 2.2 `DeliveryStatus` (internal business status pipeline)
Single source of truth for the order lifecycle. Terminal states: `DELIVERED`, `CANCELED`, `RETURNED`.
`PLACED` (created, held) → `PENDING_DISPATCH` (hold window open) → `DISPATCHED` (waybill issued) → `IN_TRANSIT` → `OUT_FOR_DELIVERY` → `DELIVERED` | `FAILED` (recoverable) | `CANCELED` | `RETURNED`
Also: `HOLD` (delayed), `PENDING_PICKUP`.

### 2.3 `ShipmentStatus` (carrier projection / macro status from Trans Express)
A normalized carrier status that the poller maps Trans Express strings onto.
`SUBMITTED` | `PROCESSING` | `PICKED_UP` | `IN_TRANSIT` | `OUT_FOR_DELIVERY` | `DELIVERED` | `FAILED` | `RETURNED` | `CANCELED`

### 2.4 `CarrierProvider`
`TRANSEXPRESS` (extensible: `DOMEX`, `PROMPTX`, `KOOMBIYO`)

### 2.5 `WaybillMode`
`MANUAL` (pre-printed waybill provided) | `AUTO` (system-issued waybill)

### 2.6 `CourierEnv`
`STAGING` | `PRODUCTION`

### 2.7 `DeliveryPackageStatus` (per-parcel)
`AWAITING_WEIGH` | `WEIGHED` | `PACKED` | `DISPATCHED` | `DELIVERED` | `RETURNED`

### 2.8 `RateType`
`FLAT` | `BY_WEIGHT`

### 2.9 `ReconciliationStatus`
`PENDING_SETTLEMENT` | `MATCHED` | `PARTIAL_MATCH` | `DISCREPANCY` | `CLEARED` | `DISPUTED`

### 2.10 `StatementImportStatus`
`UPLOADED` | `PARSING` | `PARSED` | `MATCHING` | `COMPLETED` | `FAILED`

### 2.11 `RecoveryAction`
`FOLLOW_UP_CALL` | `RESCHEDULED` | `REDELIVERED` | `CANCELLED`

### 2.12 `PackagingCategory`
`POLYMAILER` | `TAPE` | `LABEL` | `BUBBLE_WRAP` | `OTHER`

### 2.13 `PackagingUnit`
`PIECE` | `ROLL` | `BOX` | `METER`

### 2.14 New `NotificationType` values (append to existing enum)
`DELIVERY_STATUS_UPDATED` | `DELIVERY_FAILED` | `DELIVERY_DISPATCHED` | `DELIVERY_DELIVERED` | `PACKAGING_LOW_STOCK` | `RECONCILIATION_DISCREPANCY` | `DELIVERY_HELD_EXPIRING` | `COD_PENDING_ALERT`

### 2.15 New `UserRole` value (append)
`DISPATCH_STAFF` — office operational role (see Part 1 §9).

---

## 3. New Models

### 3.1 `ShippingAddress`
Delivery target captured at order/checkout time. **Decoupled from `Customer`** so deliveries carry a stable snapshot even if the customer record changes.

| Field | Type | Notes |
|---|---|---|
| id | cuid | PK |
| tenantId | String | tenant scoping |
| deliveryId | String? | FK to delivery (1:1) — or inline on delivery; see note |
| customerId | String? | optional link to Customer |
| fullName | String | customer name for the label |
| phone | String | contact (E.164 normalized at dispatch) |
| phone2 | String? | secondary contact |
| addressLine1 | String | street address |
| addressLine2 | String? | optional |
| districtId | Int? | Trans Express numeric district id |
| districtName | String? | normalized text |
| cityId | Int? | Trans Express numeric city id |
| cityName | String | plain city text (fallback for without-city endpoints) |
| postalCode | String? | optional |
| isDefault | Boolean | for reusable customer addresses |
| createdAt / updatedAt | DateTime | timestamps |

**Design decision:** keep `cityId`/`districtId` optional so text-only orders still work; the dispatcher decides which endpoint variant to call based on presence of ids.

### 3.2 `Delivery` (business source of truth)

| Field | Type | Notes |
|---|---|---|
| id | cuid | PK |
| tenantId | String | scoping |
| source | DeliverySource | origin of the order |
| status | DeliveryStatus | business pipeline |
| saleId | String? | FK → Sale (if linked to a POS/counter sale) |
| customerId | String? | FK → Customer |
| addressId | String? | FK → ShippingAddress |
| orderRef | String | human/business order number (e.g., `#DEL-0001`) |
| courierOrderRef | String? | the `order_no` sent to Trans Express (maps to waybill) |
| codAmount | Decimal(12,2) | amount to collect on delivery |
| declaredValue | Decimal(12,2)? | optional goods value |
| itemCount | Int | parcel item count |
| totalWeightKg | Decimal(6,2)? | summed item weights (set pre-dispatch) |
| hubWeightKg | Decimal(6,2)? | courier-measured weight (returned by tracking) |
| shippingFee | Decimal(12,2)? | computed by rate engine |
| deliveryFee | Decimal(12,2)? | courier base fee (from tracking/ledger) |
| statusPipeline | Json? | optional ordered status history snapshot |
| holdExpiresAt | DateTime? | when the hold buffer auto-dispatches/expires |
| dispatchedAt | DateTime? | when pushed to courier |
| deliveredAt | DateTime? | when terminal delivered |
| canceledAt / canceledById | DateTime? / String? | cancel metadata |
| failureReason | String? | courier-provided failure reason text |
| notes | String? | internal notes |
| assignedStaffId | String? | dispatch/recovery staff owner |
| createdAt / updatedAt / deletedAt | DateTime | timestamps + soft delete |

Relations: `shipments CourierShipment[]`, `events DeliveryEvent[]`, `attempts DeliveryRecovery[]`, `address` (1:1), `packageStatuses` (see §3.7).

### 3.3 `CourierShipment` (carrier projection — the Trans Express order)

| Field | Type | Notes |
|---|---|---|
| id | cuid | PK |
| tenantId | String | scoping |
| deliveryId | String | FK → Delivery (1:1) |
| provider | CarrierProvider | TRANSEXPRESS |
| env | CourierEnv | staging/production snapshot |
| waybillId | String | the 8-char waybill |
| waybillMode | WaybillMode | MANUAL / AUTO |
| status | ShipmentStatus | normalized carrier status |
| rawStatus | String? | raw status string from API (diagnostics) |
| courierOrderId | String? | Trans Express order id from upload response |
| carrierLastSyncedAt | DateTime? | last poll time |
| lastRawResponse | Json? | last raw tracking/upload payload (diagnostics) |
| latestEventAt | DateTime? | timestamp of newest status history event |
| createdAt / updatedAt | DateTime | timestamps |

### 3.4 `DeliveryEvent` (status history / audit)
Append-only log of every internal or carrier status change.

| Field | Type | Notes |
|---|---|---|
| id | cuid | PK |
| tenantId | String | scoping |
| deliveryId | String | FK → Delivery |
| shipmentId | String? | FK → CourierShipment |
| status | DeliveryStatus | business status at event |
| carrierStatus | ShipmentStatus? | mapped carrier status |
| rawStatusName | String? | raw Trans Express status name |
| remarks | String? | courier remarks/note |
| eventAt | DateTime | when it happened (carrier timestamp) |
| source | String | INTERNAL / CARRIER / USER |
| createdById | String? | actor if user-driven |

### 3.5 `CourierAccount` (per-tenant Trans Express credentials + settings)

| Field | Type | Notes |
|---|---|---|
| id | cuid | PK |
| tenantId | String | unique per tenant |
| provider | CarrierProvider | TRANSEXPRESS |
| env | CourierEnv | staging/production |
| email | String | login email (staging/prod) |
| apiKey | String | bearer token or long-lived API key (from portal) |
| originDistrictId | Int? | default origin for rate engine |
| originCityId | Int? | default origin city |
| pickupAddress | String? | default pickup address |
| isActive | Boolean | master switch |
| lastTokenIssuedAt | DateTime? | token age |
| createdAt / updatedAt | DateTime | timestamps |

**Security:** the token/API key is sensitive. Store encrypted or via env-injected secret reference; never return in API responses. Consider referencing an encrypted secret and only reading server-side.

### 3.6 `RateCard` + `RateCardEntry` (local shipping-rate engine)

`RateCard` (per tenant, one active card):
| Field | Type | Notes |
|---|---|---|
| id | cuid | PK |
| tenantId | String | scoping |
| name | String | e.g., "Trans Express Standard" |
| isActive | Boolean | only one active allowed |
| baseRate | Decimal(12,2) | first-kg rate |
| extraKgRate | Decimal(12,2) | per additional kg (ceil) |
| freeBaseWeightKg | Decimal(6,2) | default 1 |
| coddCommissionPct | Decimal(5,2)? | COD commission % for net calc |
| vatRatePct | Decimal(5,2)? | VAT on fee for net calc |
| createdAt / updatedAt | DateTime | timestamps |

`RateCardEntry` (zone overrides: origin district → destination district/city):
| Field | Type | Notes |
|---|---|---|
| id | cuid | PK |
| tenantId | String | scoping |
| rateCardId | String | FK → RateCard |
| originDistrictId | Int? | null = any |
| destinationDistrictId | Int? | null = any (city-level overrides also allowed) |
| destinationCityId | Int? | optional city-level precision |
| baseRate | Decimal(12,2)? | override base |
| extraKgRate | Decimal(12,2)? | override extra |

### 3.7 `Package` / `PackageStatus` (parcel-level, for multi-parcel + weigh-in)
(Optional Phase-1 extension; include the model so the schema is forward-compatible.)

| Field | Type | Notes |
|---|---|---|
| id | cuid | PK |
| tenantId | String | scoping |
| deliveryId | String | FK → Delivery |
| status | DeliveryPackageStatus | pack/weigh/dispatch flow |
| weightKg | Decimal(6,2)? | measured weight |
| createdAt / updatedAt | DateTime | timestamps |

### 3.8 `PackagingItem` (office packaging inventory)

| Field | Type | Notes |
|---|---|---|
| id | cuid | PK |
| tenantId | String | scoping |
| category | PackagingCategory | polymailer/tape/label/bubble wrap |
| name | String | e.g., "Polymailer M" |
| sku | String? | optional |
| unit | PackagingUnit | piece/roll/box/meter |
| quantityOnHand | Int | current stock |
| lowStockThreshold | Int | alert threshold |
| autoDeduct | Boolean | consumed automatically on dispatch |
| consumptionPerParcel | Decimal(6,2)? | e.g., 1 polymailer + 1 label |
| createdAt / updatedAt / deletedAt | DateTime | timestamps |

### 3.9 `PackagingConsumption` (audit of deductions)
| Field | Type | Notes |
|---|---|---|
| id | cuid | PK |
| tenantId | String | scoping |
| deliveryId | String | FK → Delivery (what it was used for) |
| packagingItemId | String | FK → PackagingItem |
| quantity | Decimal(6,2) | deducted |
| createdAt | DateTime | when |

### 3.10 `DeliveryRecovery` (failed-order recovery / follow-up)
| Field | Type | Notes |
|---|---|---|
| id | cuid | PK |
| tenantId | String | scoping |
| deliveryId | String | FK → Delivery |
| action | RecoveryAction | follow-up / reschedule / redeliver / cancel |
| staffId | String | assigned/acting staff |
| notes | String? | call log / outcome |
| redeliveryShipmentId | String? | if redelivered, link to new shipment |
| createdAt | DateTime | timestamp |

### 3.11 `ReconciliationLedgerEntry` (expected COD receivables)
| Field | Type | Notes |
|---|---|---|
| id | cuid | PK |
| tenantId | String | scoping |
| deliveryId | String | FK → Delivery |
| waybillId | String? | denormalized for matching |
| expectedCod | Decimal(12,2) | COD at dispatch |
| status | ReconciliationStatus | default PENDING_SETTLEMENT |
| expectedFee | Decimal(12,2)? | courier fee expectation (optional) |
| settledAmount | Decimal(12,2)? | matched from statement |
| settledAt | DateTime? | when matched |
| statementImportId | String? | FK → StatementImport |
| discrepancyNote | String? | reason for partial/discrepancy |
| createdAt / updatedAt | DateTime | timestamps |

### 3.12 `StatementImport` (CSV remittance upload batch)
| Field | Type | Notes |
|---|---|---|
| id | cuid | PK |
| tenantId | String | scoping |
| provider | CarrierProvider | TRANSEXPRESS |
| filename | String | original file name |
| uploadedById | String | actor |
| status | StatementImportStatus | parse/match/completed/failed |
| rowCount | Int | total rows |
| matchedCount | Int | matched rows |
| discrepancyCount | Int | flagged rows |
| rawRows | Json | parsed rows snapshot |
| parseError | String? | error message if parse failed |
| uploadedAt / completedAt | DateTime | timestamps |

---

## 4. Existing Model Modifications

### 4.1 `Tenant`
Add back-relations for every new tenant-scoped model:
`deliveries`, `shipments` (via delivery), `shippingAddresses`, `courierAccounts`, `rateCards`, `rateCardEntries`, `packagingItems`, `packagingConsumptions`, `deliveryRecoveries`, `reconciliationLedgerEntries`, `statementImports`.

### 4.2 `Customer`
Add optional `shippingAddresses ShippingAddress[]` back-relation. No address columns are added to `Customer` itself (addresses are delivery-scoped snapshots). Optionally add `orderCount Int @default(0)` for CRM repeat-buyer badges (separate SRS module — noted here as forward-compatible, not required for Trans Express).

### 4.3 `Sale`
Optional `deliveries Delivery[]` back-relation so a POS sale can become a delivery (Phase-1 scope: manual ERP-created deliveries can be sale-linked; website orders become deliveries directly).

### 4.4 `NotificationRecord`
Append the new `NotificationType` enum values (§2.14). No model change needed.

### 4.5 `User`
`DISPATCH_STAFF` added to `UserRole` enum. Optional back-relations for `assignedStaff` on deliveries and recovery actions.

---

## 5. Relationship Summary

```
Tenant 1─* ShippingAddress
Tenant 1─* Delivery           1─1 ShippingAddress
Delivery 1─1 CourierShipment   1─* DeliveryEvent
Delivery 1─* DeliveryRecovery  1─* Package
Delivery 1─* ReconciliationLedgerEntry
Tenant 1─* CourierAccount (1 active)
Tenant 1─* RateCard 1─* RateCardEntry
Tenant 1─* PackagingItem   1─* PackagingConsumption (→ Delivery)
Tenant 1─* StatementImport 1─* ReconciliationLedgerEntry
Delivery 1─1 Sale (optional) ; Customer 1─* ShippingAddress ; Customer 1─* Delivery
```

---

## 6. Index Strategy

Add `@@index([tenantId])` on every owned model. Add composite indexes for the hot paths:

- `Delivery`: `@@index([tenantId, status])`, `@@index([tenantId, dispatchedAt])`, `@@index([tenantId, orderRef])`, `@@index([tenantId, customerId])`.
- `CourierShipment`: `@@index([tenantId, status])` (poller scans non-terminal), `@@unique([tenantId, waybillId])` (prevent duplicate waybills), `@@index([provider])`.
- `DeliveryEvent`: `@@index([deliveryId, eventAt])`.
- `ReconciliationLedgerEntry`: `@@index([tenantId, status])`, `@@index([waybillId])` (CSV matching), `@@index([tenantId, deliveryId])`.
- `RateCard`: `@@unique([tenantId, name])`; `RateCardEntry`: `@@index([rateCardId])`.
- `PackagingItem`: `@@index([tenantId, category])`.
- `StatementImport`: `@@index([tenantId, uploadedAt])`.

---

## 7. Unique Constraints & Data Integrity

- `CourierShipment.waybillId` unique per tenant — the poller and dispatcher rely on this to avoid duplicate waybills.
- `CourierAccount.tenantId` unique — one account per tenant per provider (a tenant could theoretically hold both staging and prod configs; enforce one active per env if desired).
- `RateCard` — enforce a single active card per tenant at the service layer.
- `ShippingAddress` for a delivery is snapshotted (not live-updated by later customer edits).

---

## 8. Migration Strategy

Follow the existing pattern: edit `prisma/schema.prisma`, then generate migrations. Recommended migration names (one per feature bundle so they're reviewable):

1. `add_delivery_and_shipment_models` — `DeliverySource`, `DeliveryStatus`, `ShipmentStatus`, `CarrierProvider`, `WaybillMode`, `CourierEnv`, `DeliveryPackageStatus`, `ShippingAddress`, `Delivery`, `CourierShipment`, `DeliveryEvent`, `Package`.
2. `add_courier_accounts_and_rate_cards` — `CourierAccount`, `RateCard`, `RateCardEntry`, `RateType`.
3. `add_packaging_inventory_models` — `PackagingCategory`, `PackagingUnit`, `PackagingItem`, `PackagingConsumption`.
4. `add_recovery_and_reconciliation_models` — `RecoveryAction`, `ReconciliationStatus`, `StatementImportStatus`, `DeliveryRecovery`, `ReconciliationLedgerEntry`, `StatementImport`.
5. `add_dispatch_staff_role_and_notification_types` — extend `UserRole` and `NotificationType`.

Each migration is generated by Prisma (`npx prisma migrate dev --name ...`) and adds `Tenant` back-relations accordingly. Update the seed script idempotently (findFirst-guard + skip) to provision a sample `CourierAccount`/`RateCard` for demo tenants if useful.

---

## 9. Summary → Part 3

Part 3 (**Courier Integration Layer**) defines how the `CourierShipment`/`ShippingAddress`/`RateCard` models are used against the real Trans Express API: authentication, endpoint selection, request/response field mapping, error handling, idempotency, the tracking poller, and the local rate engine. It assumes the schema from this part is in place.
