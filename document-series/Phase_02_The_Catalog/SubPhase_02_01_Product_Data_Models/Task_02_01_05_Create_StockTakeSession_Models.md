# Task 02.01.05 — Create StockTakeSession Models

## Metadata

| Property             | Value                                              |
| -------------------- | -------------------------------------------------- |
| Sub-Phase            | 02.01 — Product & Variant Data Models              |
| Phase                | 02 — The Catalog                                   |
| Estimated Complexity | Medium                                             |
| Dependencies         | Task_02_01_04 (StockMovement model must exist)     |

---

## Objective

Add the StockTakeStatus enum along with the StockTakeSession and StockTakeItem models to prisma/schema.prisma, apply the migration, and confirm the two-model structure correctly represents the lifecycle of a physical stock count operation.

---

## Instructions

### Step 1: Understand the Stock Take Business Process

Before defining the models, understand the process they support. A stock take is a periodic physical count of inventory items to reconcile the system's recorded quantities against what is actually on the shelves. In VelvetPOS, a stock take follows this lifecycle:

A store manager initiates a session, optionally scoping it to a single category or leaving it open for the full catalog. The session is created in the IN_PROGRESS state. Staff walk the floor, scan or manually identify each variant, and enter the physically counted quantity for each item. Each variant being counted is a StockTakeItem within the session. When the manager believes all items have been counted, they submit the session for review, transitioning it to PENDING_APPROVAL. A user with the stock:take:approve permission then reviews the counted quantities and discrepancies. If the counts look correct, they approve the session (APPROVED), which triggers the system to create StockMovement records for all items with non-zero discrepancies, updating those variants' stockQuantity to match the physically counted amounts. If the counts look suspicious or incomplete, the approver can reject the session (REJECTED), returning the catalog to its previous state without any stock adjustments.

### Step 2: Define the StockTakeStatus Enum

Add the StockTakeStatus enum to prisma/schema.prisma. The values are:

- IN_PROGRESS: the session has been started and staff are actively counting items — stock adjustments cannot be applied while in this state
- PENDING_APPROVAL: the initiating staff member has marked the count as complete and submitted it for manager review
- APPROVED: the manager has confirmed the counts and the system has applied all stock adjustments
- REJECTED: the manager has rejected the session — no stock changes are made and the session is closed

### Step 3: Define the StockTakeSession Model

Add the StockTakeSession model. Its fields are:

- id: String, primary key, CUID default
- tenantId: String, FK referencing Tenant
- categoryId: optional and nullable String — when set, this session covers only the variants belonging to that category; when null, the session covers the entire catalog. This is a plain string field at this stage and will not carry a formal @relation decorator in this task to avoid coupling issues, since the FK validity is enforced by the service layer.
- status: the StockTakeStatus enum, defaulting to IN_PROGRESS
- initiatedById: non-optional String, FK referencing User — the person who started the session
- approvedById: optional and nullable String, FK referencing User — populated only when the session reaches APPROVED or REJECTED state; records who made the final decision
- startedAt: DateTime, default now() — when the session was created
- completedAt: optional nullable DateTime — set when the session transitions to PENDING_APPROVAL
- approvedAt: optional nullable DateTime — set when the session transitions to APPROVED or REJECTED
- notes: optional String — free-text memo visible to both the initiator and approver

Add relation fields: an initiatedBy relation pointing to User via initiatedById, an approvedBy relation pointing to User via approvedById (nullable relation), and a items relation as an array of StockTakeItem.

Add an index on [tenantId, status] to support the management dashboard query "show all in-progress stock takes for this tenant", which is displayed as an alert if any session is left open for too long.

### Step 4: Define the StockTakeItem Model

Add the StockTakeItem model. Its fields are:

- id: String, primary key, CUID default
- sessionId: non-optional String, FK referencing StockTakeSession — every item belongs to exactly one session
- variantId: non-optional String, FK referencing ProductVariant — the specific variant being counted
- systemQuantity: Int — the stock quantity as recorded in the database at the time this item was added to the session. This is a snapshot value and is never updated after the item is created.
- countedQuantity: optional and nullable Int — the physical quantity entered by staff during the count. This is null until staff enter a count for this item.
- discrepancy: optional and nullable Int — computed as countedQuantity minus systemQuantity. This is null until countedQuantity is entered. A positive discrepancy means more units were found than the system expected; a negative discrepancy means fewer units were found.
- isRecounted: Boolean defaulting to false — set to true if this item was counted a second time for verification after an initial discrepancy was flagged by the approver
- createdAt: DateTime, default now()
- updatedAt: DateTime, @updatedAt

Add a composite unique constraint using @@unique([sessionId, variantId]) to ensure no variant appears twice in the same session. This prevents double-counting errors during data entry.

Add relation fields: a session relation pointing to StockTakeSession via sessionId, and a variant relation pointing to ProductVariant via variantId.

Add an index on [sessionId] to support fetching all items in a session efficiently.

### Step 5: Run the Migration

Run pnpm prisma migrate dev --name add_stock_take_models. Review the generated SQL to confirm: the StockTakeStatus enum is created; both tables are created with correct column types; the unique constraint on [sessionId, variantId] is present; and the index on [tenantId, status] exists on the session table. Apply the migration and resolve any errors.

### Step 6: Confirm Relationships in Prisma Studio

Open pnpm prisma studio and navigate to the StockTakeSession table. Confirm the columns are present and that the status column shows the enum values correctly. Navigate to the StockTakeItem table and confirm the sessionId and variantId columns exist. Verify the unique constraint prevents duplicate (sessionId, variantId) pairs by attempting to manually insert a duplicate through Studio and confirming the constraint violation is raised.

---

## Expected Output

- StockTakeStatus enum with four values is defined in schema and database
- StockTakeSession table has eleven fields including nullable categoryId, initiatedById, approvedById, completedAt, and approvedAt
- StockTakeItem table has nine fields with nullable countedQuantity and discrepancy
- Unique constraint on [sessionId, variantId] prevents duplicate items per session
- systemQuantity is captured at item creation and not automatically updated
- Migration applies cleanly with no errors

---

## Validation

- [ ] Migration named "add_stock_take_models" applies without errors
- [ ] StockTakeStatus is available as a TypeScript enum in the Prisma Client with all four values
- [ ] StockTakeItem has a composite unique constraint on [sessionId, variantId]
- [ ] countedQuantity and discrepancy on StockTakeItem are nullable Int fields
- [ ] systemQuantity is a non-nullable Int on StockTakeItem (captured at session item creation time)
- [ ] The index on [tenantId, status] exists on the StockTakeSession table
- [ ] pnpm tsc --noEmit passes with no errors

---

## Notes

The systemQuantity snapshot on StockTakeItem is captured at the moment the item is added to the session, not at the moment the session is created. This distinction matters for long-running stock takes. Consider a session that takes several hours to complete, during which a cashier processes a sale that reduces a variant's stock from 10 to 8. If systemQuantity were captured at session start, the baseline for that variant would be 10. But if the variant is added to the session after the sale occurs, the baseline would correctly be 8, reflecting the current reality. The service layer must capture stockQuantity at the moment of addStockTakeItem, not at session creation.

For category-scoped sessions where items are pre-populated at session creation, the systemQuantity for each pre-populated item is captured at the time of session creation. Store staff should complete a category-scoped session promptly to minimise the drift between the captured baseline and any concurrent sales.

The isRecounted flag is a quality assurance feature. When a supervisor reviews the PENDING_APPROVAL session and finds a suspicious discrepancy (for example, a variant showing 20 fewer units than expected), they can mark the item for recounting before approving or rejecting the entire session. The staff member then physically recounts that item and updates the countedQuantity. The isRecounted flag ensures the audit trail shows that this item received additional scrutiny.

The discrepancy field is stored explicitly rather than being computed as a virtual column because PostgreSQL generated columns have limitations (they cannot reference other row values in complex expressions without specific configurations in some versions), and storing it explicitly simplifies reporting queries significantly since GROUP BY on discrepancy ranges becomes straightforward.
