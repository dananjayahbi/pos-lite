# 45 — Recovery Lifetime Tracking & Staff Metrics

**Module:** M14 — Failed Order & Return Recovery
**Severity:** Low
**Status:** Not implemented
**Related docs:** [44 — Failed-Order Recovery Workflow](./44-failed-order-recovery-workflow.md), [43 — Failure Reason Display](./43-failure-reason-display.md)

## Issue / Current State
No `DeliveryRecovery` rows are ever created because the recovery workflow is unused (see doc 44). Consequently, there is no lifetime attempt history per delivery and no per-staff recovery metrics. There is no view of how many failed orders each staff member has handled, how many were successfully recovered (redelivered/delivered), and how many were permanently cancelled. The `DeliveryRecovery` model already supports the data shape (per delivery, per staff, per action) but nothing reads or aggregates it.

## Impact
Management has no visibility into recovery performance. Without lifetime tracking, there is no way to measure which staff are effective at recovering failed deliveries, to hold staff accountable for abandoned orders, or to identify systemic failure patterns (e.g. repeated failures on the same route/courier). This leaves the recovery funnel unmanaged and unmeasured.

## Implementation Plan
### Step 1 — Ensure recovery attempts are persisted
Rely on doc 44 so every recovery action (follow-up call, reschedule, redeliver, cancel) writes a `DeliveryRecovery` row capturing `staffId`, `action`, `deliveryId`, notes, and (for redeliveries) the new shipment id. This is the data foundation for all metrics.

### Step 2 — Add a recovery staff performance endpoint
Add an API endpoint (for example under `erp/src/app/api/reports/` as a `recovery-staff-performance` report, or under the delivery area) that aggregates `DeliveryRecovery` rows by staff for a configurable period. For each staff member, report the number of assigned failed orders, the number recovered (leading to a delivered/redelivered outcome), the number permanently cancelled, and the distribution of recovery actions. Gate it appropriately per the reports permission model.

### Step 3 — Add a staff performance view
Add a UI view (reusing existing report/staff tables) that renders the aggregated metrics per staff member, with drill-down to individual failed deliveries and their attempt history. Show lifetime totals as well as period-filtered values, and surface low-recovery or high-cancellation staff for attention.

### Step 4 — Expose per-delivery attempt history
Show the full `DeliveryRecovery` attempt history on the delivery detail screen (list of actions, staff, timestamps, notes, redelivery shipment ids) so a failed delivery's full recovery journey is inspectable end-to-end.

## Dependencies
- Doc 44 is a hard prerequisite: without the recovery workflow writing `DeliveryRecovery` rows, there is no data to aggregate.
- Doc 43 provides the failure reason context associated with recovery attempts.
- Follows the reports aggregation and permission patterns.

## Files / Areas affected
- `erp/src/app/api/reports/` (new recovery-staff-performance endpoint) or delivery reports area
- Delivery/staff performance UI components
- `erp/src/components/delivery/DeliveryDetailPanel.tsx` (attempt-history display)
- Aggregation logic over the existing `DeliveryRecovery` model
