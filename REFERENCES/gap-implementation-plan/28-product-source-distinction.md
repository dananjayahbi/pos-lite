# 28 — Product Source Distinction

**Module:** M9 — Manufacturing & Supply Chain
**Severity:** High
**Status:** Not implemented
**Related docs:** 26-bom-auto-deduction.md, 29-batch-expiry-tracking.md, 30-batch-expiry-visibility.md

## Issue / Current State
A full purchase-order and goods-received workflow exists in the ERP (`erp/src/lib/services/purchaseOrder.service.ts` and related API routes). However, `Product` and `ProductVariant` have no `productSource` field distinguishing whether a good is MANUFACTURED in-house or TRADED/resold. The product creation wizard (`erp/src/app/(store)/inventory/new/page.tsx`) and the product forms do not capture this distinction.

Because the source is not recorded, manufactured and traded goods are indistinguishable in the catalog, and the system cannot decide whether production (BOM) is required for a product.

## Impact
Without source distinction, the ERP cannot route manufactured goods through the BOM/production flow (26) while letting traded goods bypass it. This prevents accurate production planning and forces a single, incorrect treatment for all products, which is wrong for a business that both manufactures and resells.

## Implementation Plan
### Step 1 — Data model
Add a `productSource` field to `Product` (and/or `ProductVariant`) in `erp/prisma/schema.prisma`, with an enum (MANUFACTURED, TRADED). Add a Prisma migration and update generated types.

### Step 2 — Product wizard update
Update the product wizard (`erp/src/app/(store)/inventory/new/page.tsx`) and any product edit forms to capture `productSource`, defaulting sensibly and validating the selection.

### Step 3 — Source-driven behavior
Use `productSource` to control downstream flows: manufactured goods are eligible for BOM assignment and production logging (26), while traded goods skip production and proceed through purchase/receipt only.

### Step 4 — Data migration for existing products
Provide a backfill strategy for existing products to assign a default source, with an admin review path where source is genuinely ambiguous.

## Dependencies
- 26 uses the manufactured-vs-traded distinction to gate BOM/production.
- 29 requires source distinction to make batch/expiry mandatory only for traded goods on receipt.

## Files / Areas affected
- `erp/prisma/schema.prisma` — `Product`/`ProductVariant` source field + enum.
- `erp/src/app/(store)/inventory/new/page.tsx` and product form components.
- `erp/src/lib/services/product.service.ts` — source handling.
- `erp/prisma/migrations/` — new migration + backfill.
