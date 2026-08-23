# 26 — BOM Auto Deduction

**Module:** M8 — Factory & Raw Materials
**Severity:** High
**Status:** Not implemented
**Related docs:** 24-raw-material-inventory.md, 25-factory-manager-role.md, 27-raw-material-alerts.md, 28-product-source-distinction.md

## Issue / Current State
There is no bill-of-materials concept. The Prisma schema has no `BillOfMaterials` model, so there is no record of which raw materials produce a finished product or in what quantities. There is also no production/finished-goods logging flow. Stock movements for finished goods exist via `StockMovement`, but the `StockMovementReason` enum lacks a MANUFACTURED / PRODUCED reason, so produced goods cannot be represented distinctly from purchased or adjusted stock.

Because there is no BOM and no production logging, no raw materials are ever automatically consumed when finished goods are produced.

## Impact
Manufacturing cannot be modeled or recorded. Finished goods appear from nowhere, raw-material stock is never reduced, and ingredient usage cannot be reconciled. This makes accurate raw-material levels and production costing impossible and undermines inventory integrity for any factory operation.

## Implementation Plan
### Step 1 — BOM data model
Create a `BillOfMaterials` Prisma model linking a finished product/variant to a set of raw materials and their required quantities (from the `RawMaterial` model in 24). Add a Prisma migration and update generated types.

### Step 2 — New stock movement reason
Add a MANUFACTURED / PRODUCED reason to the `StockMovementReason` enum so finished-goods production is a first-class, distinct movement type.

### Step 3 — Production logging flow
Add a production/finished-goods logging service (in `erp/src/lib/services/`, alongside `inventory.service.ts`) that records produced finished-goods stock. When a production log is saved, the service automatically deducts the required raw-material quantities from each `RawMaterial` per the BOM, in a single transaction to preserve integrity.

### Step 4 — UI for production logging
Add factory-facing UI (dashboard surfaces from 25) to select a finished product, specify quantity produced, and submit. The UI surfaces the resulting raw-material consumption and validates against available stock before committing.

## Dependencies
- 24 provides the `RawMaterial` model and quantities consumed here.
- 25 provides the factory role and dashboard for the logging UI.
- 28 distinguishes manufactured goods (which require BOM/production) from traded goods.

## Files / Areas affected
- `erp/prisma/schema.prisma` — `BillOfMaterials` model + `StockMovementReason` enum.
- New production/BOM service in `erp/src/lib/services/`.
- New API routes under `erp/src/app/api/` for BOM and production logging.
- New factory UI components under `erp/src/components/`.
- `erp/prisma/migrations/` — new migration.
