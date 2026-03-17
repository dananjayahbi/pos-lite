# Task 02.01.07 — Build Inventory Service Layer

## Metadata

| Property             | Value                                                        |
| -------------------- | ------------------------------------------------------------ |
| Sub-Phase            | 02.01 — Product & Variant Data Models                        |
| Phase                | 02 — The Catalog                                             |
| Estimated Complexity | High                                                         |
| Dependencies         | Task_02_01_05 (All inventory models and enums must exist)    |

---

## Objective

Create src/lib/services/inventory.service.ts implementing all stock movement, stock take session, low stock, and stock valuation functions. The adjustStock function in this file is the sole authorized path for modifying any variant's stockQuantity — it must never be bypassed by any other part of the application.

---

## Instructions

### Step 1: Establish the Service File and Import Pattern

Create the file src/lib/services/inventory.service.ts. Import the shared Prisma Client singleton. Import the shared audit logger. Define TypeScript input interfaces for each function's parameter objects at the top of the file. These interfaces should be exported so that Route Handlers and other calling contexts can reference them for type safety.

Place a prominent comment at the top of the file stating: "All changes to ProductVariant.stockQuantity must go through adjustStock or bulkAdjustStock. Direct calls to prisma.productVariant.update or prisma.productVariant.updateMany for the stockQuantity field are forbidden outside this module." This is a convention enforced by code review.

### Step 2: Implement adjustStock — The Core Atomic Operation

The adjustStock function is the most critical function in the entire inventory system. Its signature accepts: tenantId (string), variantId (string), actorId (string), and an options object containing quantityDelta (Int — may be positive or negative), reason (StockMovementReason), note (optional string), saleId (optional string), purchaseOrderId (optional string), and stockTakeSessionId (optional string).

Implement this function using Prisma's interactive transactions (prisma.$transaction with a callback receiving a transaction client, referred to here as "tx"). Interactive transactions are used rather than batch transactions because the logic involves a read followed by a conditional write — the result of the read determines whether and how the write proceeds.

Within the transaction, perform the following steps in order:

First, use tx.productVariant.findUnique to retrieve the current variant by its id, selecting only the stockQuantity field and the tenantId field. Verify the tenantId matches the provided tenantId — if not, throw an authorization error. If the variant is not found, throw a not-found error.

Second, compute the new quantity: newQuantity = currentStockQuantity + quantityDelta. If newQuantity is less than zero, throw a validation error with a message explaining the shortfall. For example, if quantityDelta is -5 and currentStockQuantity is 3, the error should say something equivalent to "Insufficient stock: attempting to reduce by 5 but only 3 units available." This check prevents the stock from ever going negative through any path.

Third, call tx.productVariant.update to set stockQuantity to newQuantity.

Fourth, call tx.stockMovement.create to create the movement record, setting tenantId, variantId, reason, quantityDelta, quantityBefore (the original stockQuantity), quantityAfter (newQuantity), actorId, note, saleId, purchaseOrderId, and stockTakeSessionId.

Return the updated ProductVariant record.

The Prisma interactive transaction (with the callback pattern) is essential here — not the array-of-queries batch pattern — because the validation step between read and write must occur inside the atomic boundary. If two concurrent requests both read a stockQuantity of 1 and both try to sell it, only one can actually complete the write. Prisma.$transaction with the callback sends all operations within the callback to the same database connection under PostgreSQL's REPEATABLE READ isolation level, ensuring the second concurrent request will either see the committed change from the first request or encounter a serialization conflict and retry.

### Step 3: Implement bulkAdjustStock

The bulkAdjustStock function accepts tenantId, actorId, and an array of adjustment objects (each having the same shape as the options parameter of adjustStock). It wraps all individual adjustStock calls inside a single overarching Prisma.$transaction callback so that if any single adjustment fails (for example, one variant would go below zero), the entire batch is rolled back atomically.

Do not call the exported adjustStock function from inside bulkAdjustStock. Instead, extract the core logic of adjustStock into a private helper function that accepts a transaction client as its first parameter, and call that helper function from both adjustStock and bulkAdjustStock. This ensures all operations share a single database transaction rather than creating nested transactions, which Prisma does not support.

### Step 4: Implement getStockMovements

The getStockMovements function accepts tenantId and a filters object with optional fields: variantId, reason (StockMovementReason), from (DateTime), to (DateTime), actorId, page (default 1), limit (default 30). It returns a paginated result including movement records joined with the actor's name and the variant's SKU and product name for display purposes.

Construct the Prisma where clause dynamically: always include the tenantId filter; add a variantId filter when provided; add a reason filter when provided; add a createdAt gte filter when from is provided; add a createdAt lte filter when to is provided; add an actorId filter when provided.

Order results by createdAt descending (most recent first). Use include to load the actor's name and the variant's sku with its parent product name. Apply skip and take for pagination. Return { movements, total }.

### Step 5: Implement createStockTakeSession

The createStockTakeSession function accepts tenantId, actorId, and an options object with optional categoryId and notes fields.

Create the StockTakeSession record with status IN_PROGRESS, initiatedById set to actorId, startedAt set to now, and tenantId set. If categoryId is provided, verify the category exists and belongs to the tenant.

If categoryId is provided, additionally pre-populate StockTakeItem records: fetch all non-deleted ProductVariants that have products in the given category (by joining through the Product model on categoryId), and for each variant, create a StockTakeItem with systemQuantity equal to the variant's current stockQuantity and countedQuantity set to null. This pre-population should be done within a Prisma transaction together with the session creation so that both succeed or fail atomically.

If no categoryId is provided, create the session without pre-populating any items — staff will add variants manually during the session.

Return the created session along with a count of pre-populated items.

### Step 6: Implement addStockTakeItem

The addStockTakeItem function accepts sessionId, tenantId, and variantId. It adds a single variant to an existing IN_PROGRESS session. First verify the session exists, belongs to the tenant, and is in IN_PROGRESS status — throw an appropriate error if not. Verify the variant exists and belongs to the tenant. Check if a StockTakeItem already exists for this (sessionId, variantId) combination using a findUnique on the composite unique constraint — if it exists, return the existing item rather than creating a duplicate (idempotent behaviour). Create the StockTakeItem with systemQuantity equal to the variant's current stockQuantity; set countedQuantity and discrepancy to null. Return the created item.

### Step 7: Implement updateStockTakeItem

The updateStockTakeItem function accepts sessionId, itemId, and countedQuantity (Int). Verify the item belongs to the session and the session is IN_PROGRESS. Fetch the item to get its systemQuantity. Compute discrepancy as countedQuantity minus systemQuantity. Update the item's countedQuantity, discrepancy, and set updatedAt. Return the updated item. Validation: countedQuantity must be non-negative — physical counts cannot be negative numbers.

### Step 8: Implement completeStockTakeSession

The completeStockTakeSession function accepts sessionId, tenantId, and actorId. Verify the session exists and is IN_PROGRESS. Verify the calling actorId matches the initiatedById (only the initiator can submit for approval, unless the actor has a sufficiently elevated role — leave role override for Phase 02.03 UI implementation). Fetch all StockTakeItems in this session and verify that every item has a non-null countedQuantity — if any items are still uncounted, throw a validation error listing the uncounted variant SKUs. Update the session's status to PENDING_APPROVAL and set completedAt to now. Write an AuditLog entry. Return the updated session.

### Step 9: Implement approveStockTake

The approveStockTake function accepts sessionId, tenantId, and actorId. This function validates that the calling actor has the stock:take:approve permission. Fetch the session and verify it is in PENDING_APPROVAL state. Fetch all StockTakeItems where discrepancy is non-zero. For each such item, call the private stock adjustment helper with reason STOCK_TAKE_ADJUSTMENT, quantityDelta equal to the item's discrepancy, and stockTakeSessionId set to the session's ID. All these adjustments and the session status update must be performed inside a single Prisma transaction using bulkAdjustStock. After all adjustments succeed, update the session's status to APPROVED, set approvedById to actorId, and set approvedAt to now. Write an AuditLog entry. Return the approved session along with a count of adjustments made.

### Step 10: Implement rejectStockTake

The rejectStockTake function accepts sessionId, tenantId, actorId, and a reason string. Verify the session is in PENDING_APPROVAL state. Verify the actor has the stock:take:approve permission. Update the session status to REJECTED, set approvedById to actorId and approvedAt to now, and append the reason to the notes field. No stock adjustments are made. Write an AuditLog entry. Return the updated session.

### Step 11: Implement getLowStockVariants

The getLowStockVariants function accepts tenantId and an optional pagination object. Use a Prisma findMany on the ProductVariant table with a where clause: tenantId equals the provided value, deletedAt is null, and stockQuantity is less than or equal to the lowStockThreshold field. The last condition cannot be expressed directly as a static value comparison in Prisma's standard where syntax because it is a field-to-field comparison. Use a Prisma raw SQL query with prisma.$queryRaw for this specific function, selecting the variant id, sku, stockQuantity, lowStockThreshold, and the parent product name and category name. Order by the ratio of stockQuantity to lowStockThreshold ascending so the most critically low items appear first.

### Step 12: Implement getStockValuation

The getStockValuation function accepts tenantId and returns two aggregate values: totalCostValue (sum of costPrice × stockQuantity for all non-deleted, non-zero-quantity variants) and totalRetailValue (sum of retailPrice × stockQuantity for same). Use a Prisma $queryRaw with a SQL aggregate query for efficiency rather than loading all variants and computing the sum in JavaScript. Return the two totals as Prisma.Decimal values, not numbers.

---

## Expected Output

- src/lib/services/inventory.service.ts exists with all twelve exported service functions
- adjustStock uses an interactive Prisma transaction with a read-then-validate-then-write pattern
- Attempting to reduce stock below zero throws a validation error and creates no StockMovement
- bulkAdjustStock shares a single transaction across all adjustments
- createStockTakeSession pre-populates items when categoryId is provided
- approveStockTake creates StockMovement records for all non-zero discrepancies atomically
- getLowStockVariants uses a raw SQL field-to-field comparison
- getStockValuation returns Decimal totals, not JavaScript numbers

---

## Validation

- [ ] adjustStock with a quantityDelta that would bring stock below zero throws without writing to the database
- [ ] adjustStock creates exactly one StockMovement and updates stockQuantity atomically
- [ ] Two concurrent adjustStock calls for the same variant do not produce a negative stockQuantity
- [ ] bulkAdjustStock rolls back all changes if any single adjustment fails
- [ ] completeStockTakeSession rejects sessions with uncounted items
- [ ] approveStockTake only applies adjustments for items with non-zero discrepancy
- [ ] getStockValuation returns Decimal types for both aggregate values
- [ ] pnpm tsc --noEmit passes with no type errors in inventory.service.ts

---

## Notes

The concurrency safety of adjustStock relies on PostgreSQL's transaction isolation. When two transactions both read the same variant's stockQuantity, compute a new value, and attempt to update it, PostgreSQL's REPEATABLE READ isolation (Prisma's default for interactive transactions) will cause the second transaction's update to fail with a serialization error if the row has been modified since the first transaction began. Prisma's interactive transaction implementation handles this with automatic retries in some versions. In production, it is recommended to verify the retry behaviour by load-testing the barcode scan to sale conversion endpoint with concurrent requests.

The getLowStockVariants raw SQL query is a pragmatic exception to the "use Prisma query builder only" convention. Field-to-field comparisons (comparing stockQuantity to lowStockThreshold on the same row) are not expressible in Prisma's standard where syntax. This is a known limitation of the Prisma query builder that will be addressed in a future version. The raw query should be kept minimal and clearly documented, and it must always include the tenantId filter to prevent cross-tenant data access.

getStockValuation should never be called with a tenantId derived from user input without validation. It should only ever be called with the tenantId from the authenticated session.
