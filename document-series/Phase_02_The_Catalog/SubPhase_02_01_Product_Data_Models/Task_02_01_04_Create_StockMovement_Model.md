# Task 02.01.04 — Create StockMovement Model

## Metadata

| Property             | Value                                              |
| -------------------- | -------------------------------------------------- |
| Sub-Phase            | 02.01 — Product & Variant Data Models              |
| Phase                | 02 — The Catalog                                   |
| Estimated Complexity | Medium                                             |
| Dependencies         | Task_02_01_03 (ProductVariant model must exist)    |

---

## Objective

Add the StockMovementReason enum and the StockMovement model to prisma/schema.prisma, apply the migration, and confirm that the movement table is structured to serve as an immutable audit trail for all stock quantity changes.

---

## Instructions

### Step 1: Define the StockMovementReason Enum

Add the StockMovementReason enum to prisma/schema.prisma. This enum captures the business reason for every change to a variant's stock quantity. The values and their intended meanings are:

- FOUND: stock that was discovered during a physical search, previously thought to be missing
- DAMAGED: units that became unsellable due to damage (torn, stained, defective) and are being written down
- STOLEN: confirmed or suspected theft resulting in a stock reduction
- DATA_ERROR: a corrective adjustment to fix a clerical or data entry mistake — typically zero-net entries used only with manager authorisation
- RETURNED_TO_SUPPLIER: units sent back to a supplier and removed from sellable stock
- INITIAL_STOCK: used only when first setting the opening quantity on a newly created variant
- SALE_RETURN: a unit that was sold to a customer but returned and restocked (increases stockQuantity)
- PURCHASE_RECEIVED: units added to stock upon receiving a supplier delivery — this reason is set automatically by the purchase order receiving flow in Phase 04
- STOCK_TAKE_ADJUSTMENT: the system-generated adjustment applied when a stock take session is approved — the discrepancy between system count and physical count is resolved using this reason

Each reason value triggers slightly different behaviour in the service layer and may require different permissions. For example, DAMAGED and STOLEN are manager-level adjustments, while SALE_RETURN is triggered automatically by the POS refund flow.

### Step 2: Define the StockMovement Model

Add the StockMovement model after the ProductVariant model. Its fields are:

- id: String, primary key, CUID default
- tenantId: String, FK referencing Tenant — ensures all reporting queries can be efficiently scoped to a tenant
- variantId: non-optional String, FK referencing ProductVariant — every movement must be tied to a specific variant
- reason: the StockMovementReason enum, required — captures why this movement occurred
- quantityDelta: Int, can be positive (stock gained) or negative (stock lost) — for example, a DAMAGED adjustment reducing stock by 3 has quantityDelta = -3
- quantityBefore: Int, a snapshot of the variant's stockQuantity immediately before this movement was applied
- quantityAfter: Int, a snapshot of the variant's stockQuantity immediately after this movement was applied — this must always equal quantityBefore plus quantityDelta
- actorId: String, FK referencing User — records which user created this movement, important for the audit trail
- note: optional String — free-text explanation provided by the user when creating manual adjustments
- saleId: optional and nullable String — populated when the reason is SALE or SALE_RETURN, linking the movement to the specific sale transaction (FK references Sale model, defined in Phase 03)
- purchaseOrderId: optional and nullable String — populated for PURCHASE_RECEIVED movements, linking to the purchase order in Phase 04
- stockTakeSessionId: optional and nullable String — populated for STOCK_TAKE_ADJUSTMENT movements, linking to the approving session
- createdAt: DateTime, default now()

Notice that StockMovement has no updatedAt field and no deletedAt field. This is deliberate — see the Notes section.

Add a relation field to ProductVariant via variantId, a relation field to User via actorId, and relation fields for saleId, purchaseOrderId, and stockTakeSessionId that will be resolved when those models are defined in later phases. For now, these optional string fields are left as plain strings without formal @relation decorators — those decorators will be added in Phase 03 and Phase 04 without requiring a new migration, only a schema change.

### Step 3: Add Indexes to StockMovement

The StockMovement table will grow continuously throughout the life of the store. Efficient query performance requires carefully placed indexes:

Add a composite index on [variantId, createdAt] to support the most common reporting query: "show the movement history for this specific variant, ordered by time". This index allows that query to be served entirely from the index without a table scan.

Add a composite index on [tenantId, createdAt] to support tenant-level movement reporting such as "show all stock movements in the last 30 days for this tenant". This is used by the management dashboard's activity feed.

Add an index on actorId to support the audit trail query "show all adjustments made by this user", which is useful for disciplinary investigations or manager reviews.

### Step 4: Configure Foreign Key Cascade Behaviour

Consider the ON DELETE behaviour of the variantId foreign key. If a ProductVariant is soft-deleted (deletedAt set), the StockMovement records must be preserved — they are part of the permanent audit trail. If a ProductVariant were ever hard-deleted (which should never happen in normal operation), the appropriate database behaviour is RESTRICT, meaning PostgreSQL will refuse to delete the variant while movement records exist. Prisma does not expose ON DELETE RESTRICT as a keyword directly, but it is the implicit default for foreign key constraints when no onDelete is specified. Confirm this is the behaviour in the generated migration SQL and do not override it with CASCADE.

### Step 5: Run the Migration

Run pnpm prisma migrate dev --name add_stock_movement_model. Review the generated SQL to verify: the StockMovementReason enum is created as a PostgreSQL ENUM type; the stock_movements table is created with all fields at the correct types; both composite indexes are created; and the foreign key on variantId does not specify ON DELETE CASCADE.

---

## Expected Output

- StockMovementReason enum with nine values is defined in schema.prisma and in the database
- StockMovement table exists with all fourteen fields correctly typed
- No updatedAt or deletedAt fields — the model is append-only
- Composite indexes on [variantId, createdAt] and [tenantId, createdAt] exist
- The FK on variantId uses RESTRICT semantics (default Prisma behaviour)
- Prisma Client types for StockMovement include quantityDelta, quantityBefore, and quantityAfter all as Int

---

## Validation

- [ ] Migration named "add_stock_movement_model" applies without errors
- [ ] StockMovementReason is available as a TypeScript enum in the Prisma Client
- [ ] StockMovement table has no updatedAt or deletedAt columns
- [ ] The quantityBefore, quantityAfter, and quantityDelta columns are all Int (not Decimal)
- [ ] The composite index on [variantId, createdAt] exists in the database
- [ ] Attempting to hard-delete a ProductVariant that has associated StockMovement rows raises a FK constraint violation (RESTRICT behaviour confirmed)
- [ ] pnpm tsc --noEmit passes with no errors

---

## Notes

StockMovement records are append-only. There are no update or delete operations on this table — ever. This is a fundamental invariant of the VelvetPOS stock management design. The reason is audit integrity: the movement history must be a complete, unalterable record of every quantity change that occurred, who made it, why, and when. If a movement was created in error, the correct remedy is to create a corrective movement (reason: DATA_ERROR) that reverses the effect with a note explaining the mistake. The original erroneous movement remains in the history.

The quantityBefore and quantityAfter snapshots are critical for this audit trail to be self-contained. Even if the variant's current stockQuantity changes thousands of times after a particular movement, that movement record will still correctly describe exactly what the quantity was at that moment in time. Without these snapshots, reconstructing the historical stock level at a given point in time would require summing all quantityDelta values up to that timestamp — a costly aggregation. With the snapshots, any ad-hoc point-in-time query can simply retrieve the movement record closest to the desired timestamp and read quantityAfter directly.

The three nullable FK fields (saleId, purchaseOrderId, stockTakeSessionId) follow a mutually exclusive pattern: at most one of them will be non-null on any given movement record. This is enforced by the service layer, not the database. A database CHECK constraint ensuring mutual exclusivity across nullable FKs is complex and would tie the service layer to a specific schema structure. Instead, the application guarantees this invariant by always setting exactly one of the three contextual FKs based on the movement reason.
