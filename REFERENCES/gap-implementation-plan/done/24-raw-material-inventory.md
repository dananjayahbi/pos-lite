# 24 — Raw Material Inventory

**Module:** M8 — Factory & Raw Materials
**Severity:** High
**Status:** Not implemented
**Related docs:** 26-bom-auto-deduction.md, 27-raw-material-alerts.md, 29-batch-expiry-tracking.md

## Issue / Current State
There is no raw-material inventory concept anywhere in the system. The Prisma schema (`erp/prisma/schema.prisma`) has no `RawMaterial` model. The only inventory quantity tracked is `ProductVariant.stockQuantity`, which is an `Int`. Variant-level unit data is limited to string fields `form` and `packSize`; there is no numeric unit such as Liters or Kilograms for measuring bulk raw stock.

Because there is no model, there is also no raw-material inventory UI: no listing, no create/edit form, no inbound/outbound adjustment flow, and no stock-level view for factory staff. The existing inventory surfaces (`erp/src/components/inventory/InventoryListClient.tsx`, `InventoryTable.tsx`) are all scoped to finished products and variants only.

## Impact
Factory operations cannot track bulk ingredients (oils, powders, herbs, chemicals), making it impossible to know what is on hand for production, to plan procurement, or to detect shortages before they halt production. Without numeric units (L/Kg), quantities cannot be consumed accurately during manufacturing. This is a core blocker for the entire M8 factory module (BOM deduction, alerts).

## Implementation Plan
### Step 1 — Data model
Create a `RawMaterial` Prisma model capturing name, category, numeric unit, current quantity, and a low-stock threshold. Add a `RawMaterialCategory` enum (oils-liquids, powders-herbs, chemicals) and a `Unit` enum (Liters, Kilograms) for numeric measurement. Add a Prisma migration and update the generated client types.

### Step 2 — Service layer
Add `erp/src/lib/services/rawMaterial.service.ts` following the pattern of the existing services in `erp/src/lib/services/` (e.g. `inventory.service.ts`, `product.service.ts`). Expose operations to create, update, list, adjust stock, and query low-stock materials, with multi-tenancy scoping consistent with the existing service layer.

### Step 3 — API routes
Add REST routes under `erp/src/app/api/` (e.g. `raw-materials`) covering list, create, update, and stock-adjustment actions. Reuse existing authorization patterns and the tenant-scoped data access used by other inventory APIs.

### Step 4 — Factory inventory UI
Build a raw-material inventory screen for factory staff with a table listing material, category, unit, quantity, and threshold. Provide create/edit and stock-adjust forms, reusing the component patterns from `erp/src/components/inventory/` (e.g. `InventoryTable.tsx`, `InventoryListClient.tsx`).

## Dependencies
- 27 (alerts) builds on the low-stock threshold defined here.
- 26 (BOM auto-deduction) consumes `RawMaterial.quantity` when production is logged.
- 29 (batch/expiry) may extend raw materials with batch-level tracking.

## Files / Areas affected
- `erp/prisma/schema.prisma` — new `RawMaterial` model + `RawMaterialCategory` / `Unit` enums.
- New `erp/src/lib/services/rawMaterial.service.ts`.
- New API routes under `erp/src/app/api/raw-materials/*`.
- New factory inventory UI components under `erp/src/components/`.
- `erp/prisma/migrations/` — new migration.
