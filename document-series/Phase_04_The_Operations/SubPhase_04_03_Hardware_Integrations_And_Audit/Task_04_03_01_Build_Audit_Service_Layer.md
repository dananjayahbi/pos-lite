# Task 04.03.01 — Build Audit Service Layer

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.03.01 |
| Task Name | Build Audit Service Layer |
| SubPhase | 04.03 — Hardware Integrations and Audit |
| Priority | Critical |
| Complexity | High |
| Estimated Effort | 3–4 hours |
| Depends On | AuditLog Prisma model (SubPhase 01.02), all domain service files |
| Produces | audit.service.ts, updated service files, GET /api/audit-logs route |

## Objective

Create a centralized audit service that all business-critical service files consume as a non-blocking fire-and-forget side effect. Every mutation that touches money, inventory, customer balances, staff permissions, or system configuration must produce an AuditLog record, giving owners and managers a complete, traceable history of every significant event in the system.

## Context

The AuditLog Prisma model was scaffolded in SubPhase 01.02 with fields: id, tenantId, userId, action, entityType, entityId, previousValues (Json nullable), newValues (Json nullable), ipAddress (nullable), userAgent (nullable), and createdAt. It has had no write callers until this task.

The audit log must never block a primary business transaction. If the audit write fails, the parent transaction (completing a sale, processing a return) must still succeed. This is achieved by invoking createAuditLog as an unawaited, fire-and-forget call — prefixed with void or followed by .catch(() => {}) — placed after the primary Prisma operation resolves, and never inside a Prisma transaction block.

## Instructions

### Step 1: Create the Audit Service File

Create the file at src/lib/services/audit.service.ts. Import the shared Prisma client instance from src/lib/prisma.ts. The file will export three things: the AUDIT_ACTIONS constant object, the createAuditLog function, and the getAuditLogs function.

### Step 2: Define Canonical Audit Action Constants

Define and export a plain constant object named AUDIT_ACTIONS at the top of the file. Give each key a descriptive string value. Organize the keys by domain as follows:

- Sale domain: SALE_COMPLETED with value "SALE_COMPLETED", SALE_VOIDED with value "SALE_VOIDED"
- Return domain: RETURN_COMPLETED with value "RETURN_COMPLETED"
- Customer domain: CUSTOMER_CREDIT_ADJUSTED with value "CUSTOMER_CREDIT_ADJUSTED"
- Purchase order domain: PO_STATUS_CHANGED with value "PO_STATUS_CHANGED"
- Staff domain: STAFF_ROLE_CHANGED, STAFF_PIN_CHANGED, STAFF_PERMISSION_CHANGED
- Promotion domain: PROMOTION_CREATED, PROMOTION_UPDATED, PROMOTION_ARCHIVED
- Stock domain: STOCK_ADJUSTED with value "STOCK_ADJUSTED"
- Expense domain: EXPENSE_CREATED, EXPENSE_DELETED
- Shift domain: SHIFT_CLOSED with value "SHIFT_CLOSED"
- Settings domain: SETTINGS_CHANGED with value "SETTINGS_CHANGED"

Using string constants here ensures consistent action names across all caller sites and eliminates the risk of typos or divergent action strings in different service files.

### Step 3: Implement createAuditLog

Define and export an async function createAuditLog that accepts a single destructured parameter object with the following fields: tenantId (string), userId (string), action (string), entityType (string), entityId (string), previousValues (unknown, optional), newValues (unknown, optional), ipAddress (string, optional), userAgent (string, optional).

The function body calls prisma.auditLog.create passing all provided fields in the data object. previousValues and newValues are cast to Prisma.InputJsonValue when provided, or omitted if undefined. The function returns a Promise of the created record. Callers, not this function, are responsible for suppressing rejections when used as fire-and-forget.

### Step 4: Implement getAuditLogs

Define and export an async function getAuditLogs that accepts tenantId (string) and an optional filters object with fields: entityType (string, optional), startDate (Date, optional), endDate (Date, optional), userId (string, optional), page (number, default 1), pageSize (number, default 50 clamped to max 100).

Build a Prisma where clause starting with tenantId equals the provided value, then conditionally ANDing: entityType equals the filter value if provided; createdAt gte startDate if provided; createdAt lte endDate if provided; userId equals the filter value if provided.

Call prisma.auditLog.findMany with the where clause, orderBy createdAt descending, skip calculated as (page - 1) times pageSize, and take equal to pageSize. Include a select on the related user field to return only id, name, and email — avoid loading full User records.

In parallel, call prisma.auditLog.count with the same where clause. Return an object with shape: data (the found records), total (the count), page, and pageSize.

### Step 5: Update sale.service.ts

In the sale completion handler — the function or code path that transitions a sale to COMPLETED status and commits it to the database — after the primary Prisma operation resolves successfully, add the following fire-and-forget side effect.

Call createAuditLog passing tenantId from the sale record, userId from the acting session context, action AUDIT_ACTIONS.SALE_COMPLETED, entityType "Sale", entityId the sale's id, previousValues as an object containing the previous status (e.g., { status: "ACTIVE" }), and newValues as an object containing the completed status and total amount. Prefix the call with void so TypeScript and reviewers understand it is intentionally unawaited.

Repeat the same pattern for sale voiding using AUDIT_ACTIONS.SALE_VOIDED.

### Step 6: Update return.service.ts

In the return completion code path, after the return record is committed and inventory adjustments are applied, add a void fire-and-forget audit call using AUDIT_ACTIONS.RETURN_COMPLETED, entityType "Return", entityId the return record's id, and newValues containing a summary of the return (refund amount, reason, and number of items).

### Step 7: Update customer.service.ts

Locate the credit balance adjustment function — the place where creditBalance is updated on the Customer record. Capture the previousBalance from the record fetched before the update. After the update Prisma call resolves, add a void audit call with AUDIT_ACTIONS.CUSTOMER_CREDIT_ADJUSTED, entityType "Customer", entityId the customer's id, previousValues as { creditBalance: previousBalance }, and newValues as { creditBalance: newBalance }.

### Step 8: Update Remaining Service Files

Apply the same non-blocking fire-and-forget pattern to the remaining service files:

- In staff.service.ts (or user.service.ts), log STAFF_ROLE_CHANGED after a role update, STAFF_PIN_CHANGED after a PIN hash update, and STAFF_PERMISSION_CHANGED after any permission override change
- In promotion.service.ts, log PROMOTION_CREATED immediately after a new promotion record is created, PROMOTION_UPDATED after any field change, and PROMOTION_ARCHIVED when the archived flag is set to true
- In stock.service.ts, log STOCK_ADJUSTED after any manual stock adjustment, passing the StockMovement id as entityId so the AuditLog record provides actor linkage to complement the StockMovement record
- In expense.service.ts, log EXPENSE_CREATED and EXPENSE_DELETED on the respective operations
- In shift.service.ts, log SHIFT_CLOSED when a ShiftSession is finalized, passing the shift id as entityId and including the closing cashAmount in newValues
- In the tenant settings update route handler (or settings.service.ts if it exists), log SETTINGS_CHANGED passing the previous settings sub-object in previousValues and the new sub-object in newValues

### Step 9: Create the GET /api/audit-logs API Route

Create src/app/api/audit-logs/route.ts as a Next.js App Router GET route handler. Retrieve the current session using getServerSession with the authOptions exported from src/lib/auth.ts. Return a 401 JSON response if no session exists. Return a 403 JSON response if the session role is CASHIER or STOCK_CLERK.

Parse the URL search parameters: entityType (string), startDate (ISO string, parse to Date), endDate (ISO string, parse to Date), userId (string), page (integer, default 1), pageSize (integer, default 50). Call getAuditLogs with the session's tenantId and the parsed filters. Return the result as a JSON response with a 200 status.

## Expected Output

- src/lib/services/audit.service.ts exporting AUDIT_ACTIONS, createAuditLog, and getAuditLogs
- src/app/api/audit-logs/route.ts responding to GET with paginated, filtered, and role-guarded results
- Eight updated service files each containing void fire-and-forget audit calls on their respective critical mutations
- No TypeScript compile errors introduced by the changes

## Validation

- [ ] A COMPLETED sale triggers a prisma.auditLog.create call with action "SALE_COMPLETED"
- [ ] A VOIDED sale triggers a prisma.auditLog.create call with action "SALE_VOIDED"
- [ ] A completed return triggers a prisma.auditLog.create call with action "RETURN_COMPLETED"
- [ ] A customer credit balance change triggers a prisma.auditLog.create call showing the before and after values
- [ ] Simulating a prisma.auditLog.create rejection (mock throwing) does not propagate the error to the caller of the sale completion function
- [ ] GET /api/audit-logs with no session returns 401
- [ ] GET /api/audit-logs with a CASHIER session returns 403
- [ ] GET /api/audit-logs with MANAGER session and entityType=Sale query param returns only Sale audit records

## Notes

- Keep previousValues and newValues lean — pass only the fields that changed, not entire Prisma model objects. Bloated JSON payloads in these columns degrade query performance over time
- ipAddress and userAgent can be extracted from the Next.js NextRequest headers (x-forwarded-for and user-agent) at the API route layer and passed into the service call. Services that are called directly from other services (not from an API route) may pass null for these fields — this is acceptable
- The userId parameter in createAuditLog should receive the authenticated user's id pulled from the session. For background cron jobs (birthday automation, broadcast), use a sentinel userId such as "SYSTEM" or the SUPER_ADMIN user's id from the seed
