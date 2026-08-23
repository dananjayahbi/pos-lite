# 29 — Batch Expiry Tracking

**Module:** M9 — Manufacturing & Supply Chain
**Severity:** High
**Status:** Not implemented
**Related docs:** 28-product-source-distinction.md, 30-batch-expiry-visibility.md

## Issue / Current State
There is no batch or expiry tracking anywhere. No `batchNumber` or `expiryDate` field exists on products, variants, or stock records, and there is no `BatchTracking` model. `StockMovement` has no linkage to a batch or expiry date, so individual stock receipts cannot be traced to a batch or its shelf-life.

Because batch/expiry tracking does not exist, goods-received and purchase-order flows (see 28) do not capture batch numbers or expiry dates when stock arrives.

## Impact
For perishable or lot-controlled goods, the system cannot trace which batch a sale or stock movement came from, cannot identify expiring or expired stock, and cannot support recalls or expiration-based write-offs. This is a compliance and safety gap for any product with a shelf life.

## Implementation Plan
### Step 1 — Data model
Add a `BatchTracking` Prisma model (batchNumber, expiryDate, quantity, variant, source) and/or add `batchNumber` and `expiryDate` fields to `StockMovement` and `ProductVariant`. Add a Prisma migration and update generated types.

### Step 2 — Receipt capture
Capture mandatory batch number and expiry date when traded goods are received (GRN / purchase order), leveraging the traded-goods distinction from 28 so only traded goods require this data.

### Step 3 — Movement linkage
Link `StockMovement` records to the originating batch so FIFO/FEFO consumption and traceability are possible.

### Step 4 — Service support
Extend the inventory service (`erp/src/lib/services/inventory.service.ts`) and purchase-order service (`erp/src/lib/services/purchaseOrder.service.ts`) to create, update, and query batch records and to allocate stock from batches on sale/dispatch.

## Dependencies
- 28 supplies the traded-goods distinction that makes batch/expiry mandatory only for received goods.
- 30 renders the batch/expiry data collected here.

## Files / Areas affected
- `erp/prisma/schema.prisma` — `BatchTracking` model + batch/expiry fields.
- `erp/src/lib/services/inventory.service.ts` and `purchaseOrder.service.ts`.
- GRN / PO API routes under `erp/src/app/api/`.
- `erp/prisma/migrations/` — new migration.
