# Task 03.02.02 — Build Payment Service Layer

## Metadata

| Field | Value |
|---|---|
| Task | 03.02.02 |
| Name | Build Payment Service Layer |
| Sub-Phase | 03.02 — Payments, Receipts & Offline Mode |
| Complexity | Low |
| Depends On | Task_03_02_01 |
| Produces | src/lib/services/payment.service.ts |

## Objective

Create the payment service module that exposes the primitive operations for creating payment records, retrieving payments for a sale, and computing change amounts with decimal precision. The service is intentionally narrow in scope — it provides clean, tested building blocks consumed by the larger sale creation transaction rather than orchestrating business logic directly.

## Instructions

### Step 1: Create the Service File

Create the file src/lib/services/payment.service.ts. Follow the same module conventions used by the existing service files in that directory — named exports for all public functions, TypeScript strict mode throughout, the shared Prisma client instance imported from the project's central Prisma module (src/lib/prisma.ts or wherever the singleton is declared), and the Decimal class imported from the decimal.js library for all monetary arithmetic.

Add a brief module-level comment at the very top of the file before any imports. The comment should read roughly: "payment.service provides payment creation primitives only. The orchestration of the full atomic sale transaction — creating Sale, SaleLines, and Payment records together with stock deduction — is performed in sale.service.createSale. Callers outside of sale.service should only use this module for reads and the computeChange utility."

This comment establishes the service's bounded scope for any developer who opens the file in the future.

### Step 2: Define the CreatePaymentInput Type

Define a TypeScript type called CreatePaymentInput near the top of the file, after the imports. Its fields are as follows. The saleId field is a string — the id of the Sale record to which this payment leg belongs. The method field is of type PaymentLegMethod imported from @prisma/client. The amount field is a Decimal instance — using the Decimal type here rather than number prevents callers from accidentally passing in plain JavaScript floats. The cardReferenceNumber field is an optional string or undefined — it is only expected to be present when method is CARD, but validating that coupling is the responsibility of the caller (sale.service), not this type definition.

Export this type so it is accessible from sale.service and any service tests.

### Step 3: Implement createPayment

Implement and export the createPayment function. Its first parameter is a CreatePaymentInput. Its second parameter is an optional Prisma.TransactionClient, typed as Prisma.TransactionClient from @prisma/client. When a transaction client is provided, the function uses that client's payment.create — this is the standard path when called from within sale.service.createSale's transaction block. When no transaction client is provided, the function falls back to using the singleton Prisma client directly — this path is only expected in standalone unit tests.

Before delegating to Prisma, validate that amount is strictly greater than zero using Decimal's .greaterThan method. If not, throw a descriptive Error with the message "Payment amount must be greater than zero." Do not perform a saleId existence check here — within a transaction the Sale record has already been written before createPayment is called, and outside a transaction the foreign key constraint on the database will surface any invalid saleId at persist time. Checking saleId existence in this function would create an unnecessary extra round trip and would behave incorrectly inside transactions before the Sale row is committed.

Map the CreatePaymentInput to the Prisma payment.create input shape. Return the created Payment record.

### Step 4: Implement getPaymentsForSale

Implement and export the getPaymentsForSale function. It accepts a single saleId string as its parameter. It always uses the singleton Prisma client (never a transaction client) because this is a read operation that runs outside of any transaction — typically when building the sale detail response or when rendering the receipt.

The query finds all Payment records where saleId matches the given value and orders them by createdAt ascending. Return the array of Payment records directly. If no records exist for the given saleId, an empty array is returned naturally by Prisma and the caller handles that case.

### Step 5: Implement computeChange

Implement and export the computeChange function. This is a pure utility — it has no database interaction. It accepts two Decimal parameters: totalAmount and amountPaid. It returns a Decimal representing the change due: amountPaid minus totalAmount.

If amountPaid is less than totalAmount — checked using Decimal's .lessThan method — throw an Error with the message "Insufficient funds: the amount paid is less than the total due." This error is thrown synchronously and the caller (typically the cash payment modal or the sale API route) catches it and converts it into the appropriate user-facing response.

All arithmetic inside this function uses Decimal methods: .minus for subtraction, .lessThan for comparison. Never use the raw minus operator or the < operator on Decimal instances — JavaScript will coerce them to primitives before comparison, giving incorrect results.

### Step 6: Export Summary

The module exports: the CreatePaymentInput type, and the three functions createPayment, getPaymentsForSale, and computeChange. There are no default exports. This keeps the module's public surface explicit and tree-shakeable.

## Expected Output

- src/lib/services/payment.service.ts created with all three functions and the CreatePaymentInput type exported.
- The file compiles cleanly under TypeScript strict mode with zero type errors or implicit-any warnings.

## Validation

- Write a temporary test or confirm in a manual terminal REPL that calling computeChange with a totalAmount of 100 and an amountPaid of 150 returns a Decimal equal to 50.
- Confirm that computeChange with amountPaid below totalAmount throws an error with the expected message.
- Confirm that createPayment called with amount equal to zero throws the expected validation error.
- Confirm that getPaymentsForSale called with a known saleId from the development database returns the associated Payment rows ordered by createdAt.

## Notes

- decimal.js is already listed as a project dependency from Phase 2's price calculation work. Do not run pnpm add decimal.js — it is available to import directly.
- The optional transaction client pattern (second parameter named tx, typed as Prisma.TransactionClient or undefined) is the established pattern across all services in this codebase. Maintain this pattern exactly to keep the service layer consistent and to allow service functions to be composed inside larger transactions.
- computeChange is placed in payment.service.ts rather than a shared utils file because it is semantically specific to the payment domain. Developers looking for change calculation logic will naturally look in the payment service.
- The function does not validate that the amount is reasonable relative to a sale context — it only validates the mathematical relationship. Upper-bound sanity checks (e.g., rejecting a cash payment of Rs. 1,000,000 for a Rs. 50 sale) are UI-layer responsibilities handled by input limits in the payment modals.
