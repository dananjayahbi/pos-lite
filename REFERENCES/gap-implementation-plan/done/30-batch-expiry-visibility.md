# 30 — Batch Expiry Visibility

**Module:** M9 — Manufacturing & Supply Chain
**Severity:** Medium
**Status:** Not implemented
**Related docs:** 29-batch-expiry-tracking.md, 24-raw-material-inventory.md

## Issue / Current State
Because batch and expiry data does not exist (see 29), nothing surfaces it anywhere in the application. The POS, inventory lists, and stock reports have no concept of batch number or expiry date. Inventory lists such as `erp/src/components/inventory/InventoryListClient.tsx` and `InventoryTable.tsx` do not show batch or expiry columns, and the POS components under `erp/src/components/pos/` do not display or consider expiry when selling. There are no near-expiry or expired-stock alerts.

## Impact
Even once batch/expiry data is captured, staff cannot see it where they actually work — at the point of sale, in the stock list, or in reports. Expiring stock will be sold or sit until it expires without anyone knowing, causing waste, compliance risk, and potential sale of expired goods.

## Implementation Plan
### Step 1 — Inventory list visibility
Extend `erp/src/components/inventory/InventoryListClient.tsx` and `InventoryTable.tsx` with batch number and expiry date columns, with expiry-based status badges for near-expiry and expired items.

### Step 2 — POS visibility
Add batch number and expiry date display in the POS components under `erp/src/components/pos/` so staff see the batch being sold, with warnings when a near-expiry or expired batch is selected.

### Step 3 — Stock report visibility
Include batch number and expiry date in stock reports so expiry information is available in reporting and reconciliation.

### Step 4 — Expiry alerts
Add near-expiry and expired-stock alerts, consistent with the alert mechanism introduced for raw materials in 27, using the notification system.

## Dependencies
- 29 provides the batch/expiry data this visibility renders.
- 27 provides the alerting pattern reused for expiry warnings.

## Files / Areas affected
- `erp/src/components/inventory/InventoryListClient.tsx`, `InventoryTable.tsx`.
- POS components under `erp/src/components/pos/`.
- Stock report components and report data services.
- Notification/alert configuration for expiry warnings.
