# Task 01.03.07 — Build Tenant Service Layer

## Metadata

- **Sub-Phase:** 01.03 — SaaS Infrastructure & Tenant Management
- **Phase:** 01 — The Foundation
- **Estimated Complexity:** Medium
- **Dependencies:** Task_01_03_01 (Tenant, Plan, Subscription, Invoice models created and migrated)

## Objective

Create src/lib/services/tenant.service.ts containing all service functions that manage tenant data across the platform, providing a single authoritative source of data access logic for tenant creation, retrieval, pagination, status management, and the lightweight middleware status lookup.

## Instructions

### Step 1: Create the Service File

Create the file src/lib/services/tenant.service.ts. Import the Prisma client singleton from src/lib/prisma.ts (the shared Prisma instance established in SubPhase 01.01). Import the TenantStatus, SubscriptionStatus, and AuditAction types from the Prisma client. Define and export all service functions as named async functions — do not use a class. This keeps the service tree-shakable and consistent with the functional programming style used elsewhere in the project.

### Step 2: Define the getAllTenants Function

The getAllTenants function accepts an options object with the following optional properties: search as a string for partial name matching, status as a TenantStatus enum value for filtering by tenant status, page as a number defaulting to 1, and limit as a number defaulting to 20. The function must perform two Prisma queries in parallel using Promise.all: a findMany query to retrieve the paginated records, and a count query with identical filters to get the total record count for pagination. The findMany query must filter by deletedAt being null to exclude soft-deleted tenants, include a where clause that applies a case-insensitive name contains filter when search is provided, and applies a status equals filter when status is provided. The include clause must join the subscriptions relation filtered to the active subscription (where subscriptionStatus is ACTIVE or TRIALING) and nest the plan relation inside it. The return value is an object with two keys: tenants containing the array of result records and total containing the count integer.

### Step 3: Define the getTenantById Function

The getTenantById function accepts a tenantId string. It calls Prisma findUnique matching on id, with deletedAt equal to null to exclude soft-deleted records. The include clause must join: users (limited to 5 records for the detail page preview); subscriptions with nested plan data; and invoices ordered by billingDate descending, limited to the most recent 10. Return the full result object, which may be null if no matching non-deleted tenant exists.

### Step 4: Define the createTenant Function

The createTenant function accepts a CreateTenantInput object containing storeName, slug, ownerEmail, ownerPasswordHash (the already-hashed password — hashing must be performed by the caller before this function is invoked), timezone, currency, and planId. The function runs a Prisma transaction using prisma.$transaction to ensure all operations are atomic. Inside the transaction, perform three sequential create operations: first create the Tenant record with status ACTIVE and the settings JSON assembled from the input currency and timezone along with default vatRate and ssclRate values; then create the OWNER User linked to the new tenantId using ownerEmail and ownerPasswordHash; then create the Subscription record linking the tenantId and planId with status TRIALING, currentPeriodStart as the current date, and currentPeriodEnd as 30 days from the current date. If any operation within the transaction throws, Prisma automatically rolls back all three operations. Return the created Tenant record from the transaction.

### Step 5: Define the updateTenantStatus Function

The updateTenantStatus function accepts tenantId, a TenantStatus value, and actorId (the ID of the Super Admin performing the action). It updates the tenant's status field using Prisma update. After the update, it creates an AuditLog entry using Prisma create with the actorId, an action value describing the status change, entityType set to "Tenant", and entityId set to the tenantId. Both the update and the AuditLog creation must execute inside a Prisma transaction. Return the updated Tenant record.

### Step 6: Define the suspendTenant, reactivateTenant, and triggerGracePeriod Functions

These three functions are convenience wrappers around updateTenantStatus. The suspendTenant function calls updateTenantStatus with status SUSPENDED and also explicitly sets graceEndsAt to null in the same update operation. The reactivateTenant function calls updateTenantStatus with status ACTIVE. The triggerGracePeriod function accepts an additional graceDays number parameter and calls Prisma update directly to set status to GRACE_PERIOD and graceEndsAt to the current date plus the specified number of days, then creates the AuditLog entry. All three functions accept tenantId and actorId parameters.

### Step 7: Define the getActiveTenantBySlug Function

The getActiveTenantBySlug function accepts a slug string and is the lightweight lookup called by the tenant status middleware. It must be as fast as possible — use Prisma findFirst with a where clause matching slug and deletedAt equal to null. The select clause must fetch only the id and status fields, nothing else. This minimal payload keeps the internal API endpoint fast because this function is called on every store-related request.

### Step 8: Apply Consistent Error Handling

All functions must wrap their Prisma calls in try/catch blocks. On a Prisma P2025 error (record not found when performing an update), throw a custom error with a descriptive message such as "Tenant not found". On a Prisma P2002 error (unique constraint violation, which would occur if a duplicate slug is submitted), throw a custom error with the message "A tenant with this slug already exists". For all other errors, re-throw the original error so the calling API route handler can catch and log it appropriately.

### Step 9: Export the Input Type Definitions

At the bottom of the file, export the TypeScript type aliases used as function parameters, including CreateTenantInput so the provisioning API route can import and use the same type when constructing the payload. This avoids type duplication between the service and its callers.

## Expected Output

- src/lib/services/tenant.service.ts exports all seven named functions
- Each function includes proper TypeScript typing for its parameters and return values
- Error handling covers the most common Prisma failure modes
- The tenant service is the exclusive data access layer for tenant operations — no other file contains raw Prisma queries for tenant data

## Validation

- [ ] src/lib/services/tenant.service.ts exists and exports getAllTenants, getTenantById, createTenant, updateTenantStatus, suspendTenant, reactivateTenant, triggerGracePeriod, and getActiveTenantBySlug
- [ ] getAllTenants returns paginated results respecting search and status filters
- [ ] getTenantById returns a tenant with nested subscriptions, plan, and invoice data
- [ ] createTenant creates three records transactionally and rolls back on failure
- [ ] updateTenantStatus creates an AuditLog entry alongside the status change
- [ ] getActiveTenantBySlug returns only id and status fields
- [ ] pnpm tsc --noEmit passes with no errors in this file
- [ ] All soft-deleted tenants (where deletedAt is not null) are excluded from all queries

## Notes

Placing hashing responsibility on the caller of createTenant rather than inside the service function itself is a deliberate design decision. The service layer should work with already-sanitised and already-processed inputs. This makes the service more testable and avoids mixing cryptographic concerns with data persistence concerns. The provisioning wizard's API route handler is responsible for calling bcrypt.hash before passing the hashed value to createTenant.
