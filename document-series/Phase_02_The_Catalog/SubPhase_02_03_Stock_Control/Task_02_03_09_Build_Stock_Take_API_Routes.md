# Task 02.03.09 — Build Stock Take API Routes

## Metadata

| Field | Value |
|---|---|
| Task ID | 02.03.09 |
| Task Name | Build Stock Take API Routes |
| Parent Sub-Phase | SubPhase_02_03 — Advanced Stock Control |
| Complexity | High |
| Dependencies | SubPhase_02_01 complete |
| Output Paths | src/app/api/stock-takes/route.ts, src/app/api/stock-takes/[id]/route.ts, src/app/api/stock-takes/[id]/items/route.ts, src/app/api/stock-takes/[id]/items/[itemId]/route.ts, src/app/api/stock-takes/[id]/complete/route.ts, src/app/api/stock-takes/[id]/approve/route.ts, src/app/api/stock-takes/[id]/reject/route.ts |

---

## Objective

Implement all API routes that manage the full lifecycle of a stock take session. The routes cover listing and creating sessions, fetching full session details with items, adding and updating item counts, completing a session for approval, approving a completed session (which applies bulk stock corrections), and rejecting a session with a reason. Every state transition must be validated — no session should be able to skip states or transition backward. All routes are authenticated and permission-gated.

---

## Instructions

### Step 1: Define the Session State Machine

Before implementing individual routes, document the valid state transitions clearly so each route can enforce them:

Transition from nothing to IN_PROGRESS: POST /api/stock-takes (create session).
Transition from IN_PROGRESS to PENDING_APPROVAL: POST /api/stock-takes/[id]/complete.
Transition from PENDING_APPROVAL to APPROVED: POST /api/stock-takes/[id]/approve.
Transition from PENDING_APPROVAL to REJECTED: POST /api/stock-takes/[id]/reject.

No other transitions are valid. Any API request that would cause an invalid state transition must return a 409 Conflict response with a clear message explaining the current state and what is required before the transition can occur.

### Step 2: Build GET /api/stock-takes

Create src/app/api/stock-takes/route.ts GET handler.

Authentication and permission: requires stock:take:manage or stock:take:approve.

The query returns all StockTakeSession records for the authenticated user's tenant, ordered by startedAt descending. For each session, include:
- The initiating user's display name (join on initiatedById)
- The approving/rejecting user's display name (join on approvedById, nullable)
- The category name if categoryId is not null (join on Category model)
- A computed itemCount: total number of StockTakeItem records for this session
- A computed discrepancyCount: count of StockTakeItem records where discrepancy is not zero — this is only populated for sessions in PENDING_APPROVAL, APPROVED, or REJECTED status

Return { success: true, data: { sessions: [...], total: number } }.

### Step 3: Build POST /api/stock-takes

The POST handler on src/app/api/stock-takes/route.ts creates a new session.

Authentication and permission: requires stock:take:manage.

Request body validation with Zod: the body is an object with an optional categoryId string field. A null or absent categoryId means the session covers the full catalog.

Duplicate session check: before creating, query for any existing session in IN_PROGRESS status for the tenant. If one exists, return 409 Conflict with code "SESSION_ALREADY_IN_PROGRESS" and message "A stock take session is already in progress. Please complete or abandon it before starting a new one." Include the existing session's ID in the error data so the client can navigate to it.

Session creation: use a Prisma transaction. First, create the StockTakeSession record with status IN_PROGRESS, initiatedById set to the authenticated user's ID, startedAt as now(), and the tenantId and optional categoryId.

Item pre-population: within the same transaction, if categoryId was provided, query all non-deleted ProductVariants that belong to products in the specified category and within the tenant. For each variant, create a StockTakeItem record with the sessionId, variantId, and systemQuantity set to the variant's current stockQuantity. If no categoryId was provided (all-catalog session), pre-populate items for all non-deleted variants in the tenant. The systemQuantity captured here is the immutable baseline for this session.

Return { success: true, data: { session: {...}, itemCount: number } }.

### Step 4: Build GET /api/stock-takes/[id]

Create src/app/api/stock-takes/[id]/route.ts GET handler.

Authentication and permission: requires stock:take:manage or stock:take:approve.

Fetch the session by ID and verify it belongs to the authenticated user's tenant. Return 404 if not found or if tenant mismatch. Include all StockTakeItem records for the session, each joined with their ProductVariant and the variant's parent Product (for name and category). Compute the discrepancy for each item as countedQuantity minus systemQuantity — if countedQuantity is null, discrepancy is null. Return the full session object with items nested.

### Step 5: Build POST /api/stock-takes/[id]/items

Create src/app/api/stock-takes/[id]/items/route.ts POST handler.

This route adds a new item to an existing session — used when a staff member finds a variant during counting that was not pre-populated (for example, a variant from a different category that was shelved in the wrong area).

Authentication and permission: requires stock:take:manage.

State validation: the session must be in IN_PROGRESS status. Return 409 if the session is in any other state.

Request body validation: variantId as a required non-empty string.

Duplicate check: verify the variantId is not already in the session's item list. Return 409 if it is, with message "This variant is already included in the session."

Item creation: call inventory.service.addStockTakeItem with the sessionId, variantId, and systemQuantity captured as the variant's current stockQuantity at the moment of addition. Return the new StockTakeItem with variant information joined.

### Step 6: Build PATCH /api/stock-takes/[id]/items/[itemId]

Create src/app/api/stock-takes/[id]/items/[itemId]/route.ts PATCH handler.

Authentication and permission: requires stock:take:manage.

State validation: the parent session must be IN_PROGRESS.

Request body validation with Zod: the body may contain countedQuantity as a non-negative integer (zero is valid — staff may count zero items) and isRecounted as an optional boolean. At least one field must be present.

Ownership verification: confirm the StockTakeItem with itemId belongs to the session with id, and that the session belongs to the authenticated user's tenant. Return 404 otherwise.

Service call: invoke inventory.service.updateStockTakeItem with the itemId and the validated payload. The service computes and stores the discrepancy as countedQuantity minus systemQuantity in the database.

Return the updated item including the computed discrepancy field and the associated variant SKU and product name for the client to display.

### Step 7: Build POST /api/stock-takes/[id]/complete

Create src/app/api/stock-takes/[id]/complete/route.ts POST handler.

Authentication and permission: requires stock:take:manage.

State validation: session must be IN_PROGRESS. Return 409 otherwise.

Completeness validation: query the StockTakeItem records for the session and verify that every item has a non-null countedQuantity. If any items have a null countedQuantity, return 422 with code "INCOMPLETE_SESSION" and message "X items do not have a counted quantity. All items must be counted before completing the session." Include the count of uncounted items in the error data.

State transition: call inventory.service.completeStockTakeSession(sessionId). The service sets status to PENDING_APPROVAL, sets completedAt to now(). The service also creates STOCK_TAKE_SUBMITTED NotificationRecord entries for all OWNER and MANAGER users in the tenant.

Return { success: true, data: { session: { id, status, completedAt, discrepancyCount } } }.

### Step 8: Build POST /api/stock-takes/[id]/approve

Create src/app/api/stock-takes/[id]/approve/route.ts POST handler.

Authentication and permission: requires stock:take:approve.

State validation: session must be PENDING_APPROVAL. Return 409 if already APPROVED, REJECTED, or IN_PROGRESS.

Approval logic: call inventory.service.approveStockTake(sessionId, approvedByUserId). The service performs all of the following inside a single Prisma transaction:

First, set the session status to APPROVED, set approvedById to the authenticated user's ID, and set approvedAt to now().

Second, fetch all StockTakeItem records for the session where discrepancy is not zero. For each such item, call the internal adjustment logic (equivalent to adjustStock) with quantityDelta set to the discrepancy value and reason set to STOCK_TAKE_ADJUSTMENT. This creates a StockMovement record and updates the ProductVariant stockQuantity atomically.

Third, after all adjustments are applied, check if any adjusted variants breached their low stock threshold and create LOW_STOCK_ALERT notifications as per the standard flow.

Fourth, create one STOCK_TAKE_APPROVED NotificationRecord for the session initiator (initiatedById) with a message summarising the approval outcome: "Your stock take session has been approved. X stock corrections were applied."

Return { success: true, data: { session: { id, status, approvedAt }, adjustedCount: number } }.

### Step 9: Build POST /api/stock-takes/[id]/reject

Create src/app/api/stock-takes/[id]/reject/route.ts POST handler.

Authentication and permission: requires stock:take:approve.

State validation: session must be PENDING_APPROVAL.

Request body validation with Zod: the reason field is required, a string with minimum length 1 and maximum 500 characters. Reject requests without a reason with a 400 validation error.

Rejection logic: call inventory.service.rejectStockTake(sessionId, rejectedByUserId, reason). The service sets the session status to REJECTED, sets approvedById (repurposed as the decision-maker field) to the rejecting user's ID, and stores the rejection reason. No stock quantities are changed. A STOCK_TAKE_REJECTED NotificationRecord is created for the session initiator with the rejection reason included in the body.

Return { success: true, data: { session: { id, status } } }.

### Step 10: Apply Consistent Error Handling and Logging

Each route handler wraps its logic in a try-catch. Zod validation failures return 400. State transition violations return 409. Permission failures return 403. Resource not found or tenant mismatch return 404. Business rule violations (like incomplete items) return 422. Unexpected errors return 500.

Log each state transition at the info level server-side, including: session ID, from state, to state, actor ID, and timestamp. This logging complements the audit system described in Task_02_03_11.

---

## Expected Output

Seven route handler files implementing the complete stock take session API lifecycle. All state transitions are validated and enforced. The approve route triggers bulk stock corrections within a single transaction. The reject route makes no stock changes. All routes use the standard response envelope and follow multi-tenancy security boundaries.

---

## Validation

- POST to /api/stock-takes without any IN_PROGRESS session. Confirm a new session is created with the correct itemCount matching the seed data variants in the chosen category.
- Attempt to POST to /api/stock-takes again immediately. Confirm a 409 response with SESSION_ALREADY_IN_PROGRESS.
- PATCH an item with a valid countedQuantity. Confirm the discrepancy field in the response is correctly computed.
- POST to complete a session that still has uncounted items. Confirm a 422 with the count of uncounted items.
- Complete all item counts and POST to complete. Confirm the session moves to PENDING_APPROVAL.
- POST to approve the session as a MANAGER. Confirm all discrepant items have their stockQuantity updated in the database and StockMovement records with reason STOCK_TAKE_ADJUSTMENT exist.
- POST to reject a second test session with a reason. Confirm no stock values changed and the initiator's NotificationRecord was created.

---

## Notes

- The all-catalog session pre-population for large stores (many hundreds of variants) should be handled with a Prisma createMany call rather than iterating. This ensures the item creation is efficiently batched.
- The approve route's bulk adjustment logic mirrors the single adjustStock logic for each item. Ensure the same below-zero protection applies here too — if a previously counted variance would somehow result in negative stock when applied (which is theoretically possible if manual adjustments were made to the stock after the session started), the approval should still proceed with a best-effort adjustment to zero and log a warning rather than hard-failing the entire approval.
- The session's approvedById and approvedAt fields are shared between approve and reject outcomes — both actions are decisions made by an authorised user, so the field name is somewhat overloaded. The session status field disambiguates whether the decision was an approval or a rejection. Consider renaming to decisionMadeById in a future schema revision if the naming becomes confusing.
