# Task 02.03.11 — Setup Stock Movement Audit Logging

## Metadata

| Field | Value |
|---|---|
| Task ID | 02.03.11 |
| Task Name | Setup Stock Movement Audit Logging |
| Parent Sub-Phase | SubPhase_02_03 — Advanced Stock Control |
| Complexity | Low |
| Dependencies | Task_02_03_08 complete |
| Output Paths | src/lib/audit.ts (created or verified), src/lib/inventory.service.ts (verified), src/lib/product.service.ts (verified) |

---

## Objective

Verify and complete the audit logging strategy for all stock-modifying and product-modifying operations introduced in Phase 2. The StockMovement table already functions as the primary audit log for all inventory quantity changes. This task ensures the complementary AuditLog (from Phase 1) correctly captures the administrative and business-level events that are not inventory movements — product lifecycle events, price changes, and stock take decisions. It also verifies that the AuditLog helper is clean, consistent, and efficiently indexed.

---

## Instructions

### Step 1: Understand the Dual Audit Architecture

VelvetPOS uses two audit mechanisms that serve different purposes and must not be conflated.

The StockMovement table is the source of truth for all inventory quantity changes. It is append-only, captures quantityBefore and quantityAfter snapshots, and records who made the change, when, and why (via the reason enum). Every stock adjustment, stock take correction, purchase receipt, and sale deduction creates a StockMovement record. This table is already implemented in SubPhase_02_01 and is used throughout this sub-phase. No additional AuditLog entries are required for stock quantity changes.

The AuditLog table (from Phase 1 SubPhase_01_02) records broader administrative actions — primarily create, update, and delete operations on top-level entities like products, variants, categories, and user-facing configuration. It stores before and after JSON snapshots of changed fields, which allows support staff to investigate configuration errors.

Understanding this separation is critical to avoid double-logging and to query the correct table when investigating different types of incidents.

### Step 2: Verify or Create the AuditLog Helper

Check whether src/lib/audit.ts already exists from Phase 1 work. If it does, read its current implementation and verify it exposes the following signature: a logAuditEvent function that accepts tenantId as a string, actorId as a string, action as a string, resourceType as a string, resourceId as a string, and optional before and after objects representing field-level snapshots.

If the file does not exist, create it. The function should call Prisma's AuditLog create with the supplied fields. The before and after parameters should be serialised to JSON using Prisma's Json scalar type. Wrap the Prisma call in a try-catch that logs errors server-side without re-throwing — audit log failures must never cause the primary operation to fail. Audit logging is best-effort for Phase 2.

If the file already exists but uses a different function signature, add an overload or adapt it to accept the above parameters without breaking existing callers.

### Step 3: Verify AuditLog Integration in product.service.ts

Open src/lib/product.service.ts and verify each of the following operations calls logAuditEvent:

When a product is created, logAuditEvent is called with action "PRODUCT_CREATED", resourceType "Product", resourceId set to the new product's ID, before null, and after an object containing the product's key fields (name, categoryId, isArchived, tenantId).

When a product is updated (name, category, archive status, or other main fields), logAuditEvent is called with action "PRODUCT_UPDATED", before containing the previous values of the changed fields, and after containing the new values. Do not log unchanged fields in the before/after snapshots — only capture what actually changed.

When a product is soft-deleted (isDeleted set to true), logAuditEvent is called with action "PRODUCT_DELETED".

When a variant's retailPrice or costPrice is changed, logAuditEvent is called with action "VARIANT_PRICE_CHANGED", resourceType "ProductVariant", resourceId set to the variant ID, before containing the old price values, and after containing the new values. Price changes are particularly important to log since they affect historical margin analysis.

When a bulk price update is applied (Task_02_02's bulk price update feature), one AuditLog entry per product updated must be created, not one single entry for the entire batch. This per-product granularity ensures each affected product has a complete price change history.

If any of these integrations are missing, add them now in product.service.ts.

### Step 4: Verify AuditLog Integration in inventory.service.ts

Open src/lib/inventory.service.ts and verify the following:

When a stock take session is approved (approveStockTake), logAuditEvent is called with action "STOCK_TAKE_APPROVED", resourceType "StockTakeSession", resourceId set to the session ID, and after containing the session's summary: approvedByUserId, adjuList count, and approvedAt timestamp.

When a stock take session is rejected (rejectStockTake), logAuditEvent is called with action "STOCK_TAKE_REJECTED", with after containing the rejection reason and the rejecting user's ID.

Note: individual stock adjustments do NOT need AuditLog entries because the StockMovement records already serve as a complete, queryable audit log for inventory changes. Only the stock take lifecycle decisions (approve/reject) are logged to AuditLog since those are administrative decisions, not inventory movements.

### Step 5: Verify AuditLog Table Indexes

Open the Prisma migration files from Phase 1 and locate the migration that created the AuditLog table. Verify that a composite index exists on [tenantId, actorId, createdAt]. This index is essential for efficient queries such as "show me all audit actions taken by this user in the last month" or "show me all audit events for this tenant, ordered by time."

If the index is missing from the migration, create a new Prisma migration to add it. Name the migration "add_auditlog_indexes". In the schema.prisma file, locate the AuditLog model and add the index declaration for the three columns. Then run the migration.

Also verify that an index on [tenantId, resourceType, resourceId] exists. This index supports queries like "show me all changes ever made to Product ABC" — useful for the product detail page's history tab if one is added in a later phase.

If this second index is also missing, add it to the same migration.

### Step 6: Verify No Double-Logging for Stock Movements

As a final check in inventory.service.ts, confirm there are no existing calls to logAuditEvent inside adjustStock or bulkAdjustStock. If any exist from an earlier implementation attempt, remove them — the StockMovement record created in those functions is the authoritative record. Adding an AuditLog entry for the same event creates redundancy that will confuse future developers querying the audit trail. The rule is: StockMovement for inventory quantity changes, AuditLog for everything else.

### Step 7: Write a Summary Comment Block

At the top of src/lib/audit.ts, add a plain-English comment block (not a code block — this is documentation within the source file) describing the audit architecture: explain when to use logAuditEvent versus relying on StockMovement records, list the action string conventions used across the application (PRODUCT_CREATED, PRODUCT_UPDATED, PRODUCT_DELETED, VARIANT_PRICE_CHANGED, STOCK_TAKE_APPROVED, STOCK_TAKE_REJECTED), and note that audit log failures are swallowed and logged server-side without re-throwing.

---

## Expected Output

A verified and complete dual-audit architecture. The shared logAuditEvent helper exists with the correct signature. Product and inventory service files correctly call it for all administrative events. The AuditLog database table has the performance indexes required for efficient queries. No redundant logging exists for stock quantity changes. The architecture is documented in a source file comment.

---

## Validation

- Create a new product using the product management UI from SubPhase_02_02. Confirm an AuditLog record with action "PRODUCT_CREATED" exists in the database with the correct before/after snapshot.
- Update the retailPrice on a variant. Confirm an AuditLog record with action "VARIANT_PRICE_CHANGED" exists capturing the old and new price values.
- Approve a stock take session. Confirm an AuditLog record with action "STOCK_TAKE_APPROVED" exists with the correct session ID in resourceId.
- Make a manual stock adjustment via the form. Confirm a StockMovement record was created but NO AuditLog record was created for the adjustment — the StockMovement is the complete record.
- Using Prisma Studio, verify the AuditLog table has the [tenantId, actorId, createdAt] index defined.

---

## Notes

- The "audit log failures are swallowed" design decision is intentional for Phase 2. The primary business operation (creating a product, changing a price) must always succeed even if the audit write fails. In a Phase 5 hardened implementation, audit log writes can be made more reliable by using a separate background job or event queue.
- All action strings for logAuditEvent should use SCREAMING_SNAKE_CASE by convention. This makes them easy to filter and search in the database.
- The before and after snapshots should contain only the fields relevant to the action — not full model dumps. For example, PRODUCT_UPDATED should only capture the fields that changed, not the entire product record. This keeps the snapshots compact and meaningful.
