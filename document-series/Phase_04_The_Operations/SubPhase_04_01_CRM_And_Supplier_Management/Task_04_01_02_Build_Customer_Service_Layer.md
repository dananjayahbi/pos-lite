# Task 04.01.02 — Build Customer Service Layer

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.01.02 |
| Task Name | Build Customer Service Layer |
| SubPhase | 04.01 — CRM and Supplier Management |
| Complexity | High |
| Estimated Effort | 3–4 hours |
| Prerequisites | 04.01.01 (Customer model migrated) |
| Output | `src/lib/services/customer.service.ts` |

---

## Objective

Create the complete server-side service layer for Customer operations. This module is the single source of truth for all customer data mutations and queries used by both the dashboard management pages and the POS terminal. It must handle customer lifecycle management, paginated and filterable list queries, and the critical transactional operations — credit redemption and spend tracking — that are composed inside the sale processing pipeline.

---

## Context

The `customer.service.ts` file follows the same structural conventions as other service files in `src/lib/services/` — pure functions that accept a Prisma client or transaction client as needed, operate within tenant scope on every query, and return typed results. No business logic lives in the API routes; all of it lives here. The transactional functions `redeemCredit` and `addToSpendTotal` accept an optional transaction client parameter so they can be composed inside a `$transaction` call in the sale API route without incurring a nested transaction.

---

## Instructions

### Step 1: Create the File and Define Imports

Create `src/lib/services/customer.service.ts`. Import `prisma` from `src/lib/prisma` and `Decimal` from `decimal.js`. Define a local type alias for the Prisma transaction client using whichever pattern is already established in the existing service files — typically it mirrors `Omit<typeof prisma, ITXClientDenyList>` or is inferred from the `$transaction` callback signature. Consistent use of this pattern across service files avoids redundant type definitions.

### Step 2: Implement createCustomer

The `createCustomer` function accepts `tenantId: string` and a `data` object containing `name`, `phone`, `email`, `gender`, `birthday`, `tags`, and `notes`. Before inserting, query `prisma.customer.findFirst` where `tenantId` matches and `phone` matches and `deletedAt` is null. If a match exists, throw a typed application error with the message "A customer with this phone number already exists". If no conflict, call `prisma.customer.create` with all provided fields and return the created record.

### Step 3: Implement updateCustomer

The `updateCustomer` function accepts `tenantId`, `customerId`, and a partial data object containing any of the Customer fields. First, fetch the customer with `prisma.customer.findFirst` where both `id` and `tenantId` match and `deletedAt` is null. Throw a not-found error if no record is returned. If `phone` is being changed, run the duplicate check from Step 2 excluding the current customer ID using a Prisma `NOT` clause on `id`. Call `prisma.customer.update` with the provided fields and return the updated record.

### Step 4: Implement getCustomerById

The `getCustomerById` function accepts `tenantId` and `customerId`. Fetch the customer with `prisma.customer.findFirst` where both `id` and `tenantId` match and `deletedAt` is null. Include the last 20 `sales` using `orderBy: { createdAt: 'desc' }` and `take: 20`, each including their `saleLines` and the associated `payments`. Include the last 10 `Return` records via the sale relation ordered by `createdAt` descending. After fetching, compute `visitCount` as the length of the included sales array (note: this is truncated to 20; the true count requires a separate `_count` query — include `_count: { select: { sales: true } }` in the query for accuracy). Compute `avgOrderValue` as `totalSpend / visitCount` guarding against division by zero. Return the customer record augmented with `avgOrderValue` and `visitCount`. Throw a typed 404 error if not found.

### Step 5: Implement getCustomers

The `getCustomers` function accepts `tenantId` and an options object with optional fields: `search` (string), `tag` (string), `spendMin` (Decimal), `spendMax` (Decimal), `page` (number defaulting to 1), `limit` (number defaulting to 20, capped at 100). Trim `search` before use. Build a Prisma `where` clause starting from `{ tenantId, deletedAt: null }` and conditionally appending further conditions. The `search` filter is an `OR` of `name: { contains: search, mode: 'insensitive' }` and `phone: { contains: search, mode: 'insensitive' }`. The `tag` filter uses `tags: { hasSome: [tag] }`. The `spendMin` and `spendMax` filters use `totalSpend: { gte: ..., lte: ... }`. Execute `prisma.customer.findMany` and a parallel `prisma.customer.count` with the same `where`. Return `{ customers, total, page, totalPages: Math.ceil(total / limit) }`.

### Step 6: Implement softDeleteCustomer

The `softDeleteCustomer` function accepts `tenantId` and `customerId`. Verify the customer belongs to the tenant as in Step 3. Call `prisma.customer.update` setting `deletedAt: new Date()` and `isActive: false`. Return the updated record. The customer's historical sales data remains intact because the `Sale.customerId` FK is nullable — it is not cascade-deleted.

### Step 7: Implement applyCreditToCart

The `applyCreditToCart` function is a read-only pre-flight validation called from the POS terminal API before the credit toggle is presented. It accepts `tenantId`, `customerId`, and `requestedAmount` as a Decimal. Fetch the customer and validate tenant ownership. Return `{ validAmount, currentBalance }` where `validAmount` is `Decimal.min(requestedAmount, currentBalance)` when `currentBalance` is positive, or `new Decimal(0)` when the balance is zero or negative. This function never touches the database beyond the read — no mutation occurs here.

### Step 8: Implement redeemCredit

The `redeemCredit` function is called from inside a sale `$transaction` block. It accepts `tenantId`, `customerId`, `amount` as Decimal, and `tx` (the Prisma transaction client, required). Use `tx.customer.update` with Prisma's atomic `creditBalance: { decrement: amount.toNumber() }` to avoid a read-then-write race. Return the updated customer record. Throw immediately if `amount` is less than or equal to zero — this is a defensive guard against accidental invocations with invalid amounts.

### Step 9: Implement addToSpendTotal

The `addToSpendTotal` function accepts `tenantId`, `customerId`, `amount` as Decimal, and an optional `tx`. If `tx` is provided use it; otherwise use the global `prisma` client. Call `update` on the matching customer with `totalSpend: { increment: amount.toNumber() }`. This function does not return a meaningful value — it is a write-and-forget call. In development mode, log the operation details to the console for traceability during testing.

### Step 10: Export All Functions as Named Exports

Ensure all functions are exported as named exports — not as a default object export. This pattern is consistent with the project's existing service files and ensures that tree-shaking works predictably in any future build optimisation pass.

---

## Expected Output

- `src/lib/services/customer.service.ts` created with nine exported functions: `createCustomer`, `updateCustomer`, `getCustomerById`, `getCustomers`, `softDeleteCustomer`, `applyCreditToCart`, `redeemCredit`, `addToSpendTotal`.
- All functions have fully typed TypeScript signatures compatible with strict mode.
- `redeemCredit` and `addToSpendTotal` both accept a transaction client parameter.

---

## Validation

- [ ] `pnpm tsc --noEmit` produces no type errors in or caused by this service file.
- [ ] `createCustomer` with a duplicate phone for the same tenant throws the expected typed error.
- [ ] `getCustomers` with a `search` query returns only customers matching by name or phone.
- [ ] `applyCreditToCart` returns `validAmount: 0` when `creditBalance` is zero or negative.
- [ ] `redeemCredit` uses Prisma's atomic `{ decrement }` rather than a read-then-compute-then-write pattern.
- [ ] `getCustomerById` includes the last 20 sales and their line items in the response.

---

## Notes

- Trim all string filter inputs before passing to Prisma `contains` to prevent accidental whitespace from breaking search results.
- The `addToSpendTotal` function does not perform a tenant ownership check because it is always called from within the sale pipeline where ownership has already been validated at a higher level.
- Guard `avgOrderValue` against division by zero by returning `new Decimal(0)` when `visitCount` is 0.
- Consider extracting a small private helper `assertCustomerBelongsToTenant(tenantId, customerId)` at the top of the file to eliminate repetition across `updateCustomer`, `softDeleteCustomer`, and `applyCreditToCart`.
