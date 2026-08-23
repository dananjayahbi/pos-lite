# 43 — Courier Failure Reason Display

**Module:** M14 — Failed Order & Return Recovery
**Severity:** Medium
**Status:** Partially implemented
**Related docs:** [44 — Failed-Order Recovery Workflow](./44-failed-order-recovery-workflow.md), [45 — Recovery Staff Audit](./45-recovery-staff-audit.md)

## Issue / Current State
The `Delivery` model (`erp/prisma/schema.prisma`) has a `failureReason` String field, and it is populated by the tracking feed via `updateShipmentStatus` in `erp/src/lib/services/shipment.service.ts`. However, the field is **not rendered anywhere** in the UI: `DeliveryDetailPanel.tsx` and `DeliveryTable.tsx` (under `erp/src/components/delivery/`) do not reference `failureReason`. As a result, dispatch staff see that a delivery failed but cannot see why (e.g. "no one home", "wrong address", "recipient unavailable").

## Impact
Without the failure reason surfaced, staff cannot triage failed deliveries effectively, decide whether a follow-up or redelivery is warranted, or know the correct next step. This slows the recovery funnel, increases repeat failed deliveries, and prevents staff from learning recurring address/customer problems. It also starves the recovery workflow (doc 44) of the context needed to act.

## Implementation Plan
### Step 1 — Render the failure reason in the delivery list
In `DeliveryTable.tsx` (`erp/src/components/delivery/`), add a visible failure-reason indicator/tag next to the status for deliveries whose status is `FAILED` (or which have a `failureReason` set). Show the reason text clearly so dispatch staff can triage at a glance without opening each row.

### Step 2 — Surface the reason in the delivery detail panel
In `DeliveryDetailPanel.tsx`, display the `failureReason` prominently when present (for example in a "Failure" callout section alongside the delivery status), and include it alongside the failure `DeliveryEvent` remarks where those are available.

### Step 3 — Expose the field through list/detail APIs
Confirm the delivery list and detail API responses include `failureReason` (and any related failure event remarks) so the UI components in Steps 1 and 2 can read it. Add the field to the relevant query projections if it is not already returned.

### Step 4 — Feed into the recovery workflow
Make the displayed failure reason the primary input shown when a staff member initiates a recovery action (doc 44), so the follow-up call log and redelivery decision are made with full context.

## Dependencies
- `failureReason` is already populated by `shipment.service.ts`; only display plumbing is missing.
- Doc 44 consumes the failure reason when building the recovery workflow.
- Follows the existing delivery list/detail component and API conventions.

## Files / Areas affected
- `erp/src/components/delivery/DeliveryTable.tsx`
- `erp/src/components/delivery/DeliveryDetailPanel.tsx`
- Delivery list/detail API routes (if the field must be added to the response projection)
- Delivery service query functions in `erp/src/lib/services/delivery.service.ts` (if projections are missing)
