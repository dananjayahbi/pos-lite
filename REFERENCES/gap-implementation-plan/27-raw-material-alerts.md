# 27 — Raw Material Alerts

**Module:** M8 — Factory & Raw Materials
**Severity:** Medium
**Status:** Not implemented
**Related docs:** 24-raw-material-inventory.md, 25-factory-manager-role.md, 26-bom-auto-deduction.md

## Issue / Current State
There is no critical-stock alert mechanism for raw materials, because raw materials do not exist yet (see 24). The existing low-stock logic only covers finished `ProductVariant` stock; it does not scan raw-material quantities and does not produce factory/procurement notifications. There is no notification type specific to raw-material stock, and no scheduled check that flags materials below their low-stock threshold.

## Impact
Factory and procurement staff are not warned before a raw material runs out, so shortages are discovered reactively — typically only when production is already blocked. Missing alerts prevent proactive reordering and leave production vulnerable to avoidable stock-outs.

## Implementation Plan
### Step 1 — Alert condition definition
Define the raw-material low-stock condition against the `RawMaterial.lowStockThreshold` and current `quantity` added in 24. A material is flagged when quantity is at or below threshold.

### Step 2 — Scheduled check
Add a scheduled job (consistent with any existing scheduled-task mechanism in the ERP) that scans raw materials, detects those at or below threshold, and creates alert records. Include near-empty / critical severity where applicable.

### Step 3 — Notification type
Add a raw-material alert notification type to the existing notification system so alerts flow to factory management (25) and procurement. Reuse the notification records infrastructure already present in the schema.

### Step 4 — Alert UI
Surface raw-material alerts in the factory dashboard and procurement screens, showing which materials are low, current vs. threshold quantities, and a suggested reorder action.

## Dependencies
- 24 defines the `RawMaterial` model and threshold that this alerting reads.
- 25 provides the factory role/dashboard where alerts are surfaced.
- 26 (production) reduces raw quantities, triggering these alerts over time.

## Files / Areas affected
- `erp/src/lib/services/` — new or extended service for the scheduled raw-material check.
- Notification type configuration (schema enums / notification service).
- New scheduled job file for raw-material scanning.
- Factory dashboard / procurement UI components under `erp/src/components/`.
