# 44 — Failed-Order Recovery & Redelivery Workflow

**Module:** M14 — Failed Order & Return Recovery
**Severity:** High
**Status:** Not implemented
**Related docs:** [43 — Failure Reason Display](./43-failure-reason-display.md), [45 — Recovery Staff Audit](./45-recovery-staff-audit.md)

## Issue / Current State
The `DeliveryRecovery` model and the `RecoveryAction` enum (values `FOLLOW_UP_CALL`, `RESCHEDULED`, `REDELIVERED`, `CANCELLED`) exist in `erp/prisma/schema.prisma`, and the `manageRecovery` permission (`delivery:recovery:manage`) exists in `erp/src/lib/constants/permissions.ts` and is already assigned to `DISPATCH_STAFF` via `ROLE_PERMISSIONS`. However, these are **completely unused**: grep finds zero usages of the model, enum, or permission. There is no follow-up call log, no "Redeliver" action to re-push a failed delivery to the courier, and `cancelDelivery` in `erp/src/lib/services/delivery.service.ts` sets a delivery to `CANCELED` without restocking inventory or reversing packaging consumption.

## Impact
Failed deliveries have no structured recovery path: staff cannot log follow-up attempts, cannot initiate a redelivery from the system, and when a delivery is cancelled the inventory and packaging costs are not reversed, so stock levels and packaging balances silently drift. This creates financial and stock inaccuracy and wastes the already-shipped value of failed orders.

## Implementation Plan
### Step 1 — Build a recovery service
Create a dedicated service (for example `erp/src/lib/services/delivery-recovery.service.ts`) that encapsulates recovery actions around the existing `DeliveryRecovery` model. Expose operations to log a follow-up call (action `FOLLOW_UP_CALL`), mark rescheduled (`RESCHEDULED`), trigger a redelivery (`REDELIVERED`), and permanently cancel (`CANCELLED`). Each operation records `staffId`, `deliveryId`, `action`, optional `notes`, and for redelivery the new shipment id, and writes the appropriate `AuditLog` entry.

### Step 2 — Implement the Redeliver action
When a staff member chooses Redeliver, create a new courier shipment for the failed delivery (re-push to the courier per the existing shipment flow in `erp/src/lib/services/shipment.service.ts`), reset the delivery status out of `FAILED`, record a `REDELIVERED` recovery row with the new shipment id, and notify relevant staff/customer via the existing notification and delivery-status flows.

### Step 3 — Implement Permanent Cancel with stock reversal
Change the permanent-cancel path so that, in addition to setting the delivery to `CANCELED`, it restocks inventory (creating `StockMovement` entries with an appropriate reversal reason) and reverses packaging consumption (updating `PackagingConsumption`/`PackagingItem` quantities). Gate this on the `manageRecovery`/`delivery:cancel` permission. Reuse and extend the existing `cancelDelivery` logic in `erp/src/lib/services/delivery.service.ts` rather than duplicating it.

### Step 4 — Add API routes
Add API routes under `erp/src/app/api/delivery/` (e.g. recovery endpoints) that call the service for logging a call, redelivering, and cancelling. Enforce the `delivery:recovery:manage` permission via the permission helper in `erp/src/lib/utils/permissions.ts` (`hasPermission`/`requirePermission`), consistent with other delivery routes.

### Step 5 — Add recovery UI
Add UI controls in the delivery detail screen (`erp/src/components/delivery/DeliveryDetailPanel.tsx`) for failed deliveries: a "Follow-up Call" log (with the failure reason from doc 43 as context), a "Redeliver" button, and a "Permanent Cancel" button. Show the running list of past recovery attempts on the delivery.

## Dependencies
- Doc 43 surfaces the failure reason that staff see before acting.
- Doc 45 reads persisted recovery attempts for staff metrics — requires this workflow to write them.
- Depends on the existing `DeliveryRecovery` model, `RecoveryAction` enum, shipment service, notification flows, and the permission helper.

## Files / Areas affected
- `erp/src/lib/services/delivery-recovery.service.ts` (new)
- `erp/src/lib/services/delivery.service.ts` (`cancelDelivery` restock/reversal logic)
- `erp/src/lib/services/shipment.service.ts` (redelivery re-push)
- `erp/src/app/api/delivery/` (new recovery routes)
- `erp/src/components/delivery/DeliveryDetailPanel.tsx` (recovery controls)
- `erp/src/lib/utils/permissions.ts` usage for route gating
