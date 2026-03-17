# Task 03.01.03 — Build Sale Service Layer

## Metadata

| Field | Value |
|---|---|
| Task ID | 03.01.03 |
| Task Name | Build Sale Service Layer |
| Sub-Phase | 03.01 — POS Core |
| Complexity | High |
| Dependency | Task_03_01_02 |
| Output Files | src/lib/services/sale.service.ts, src/lib/validators/sale.validator.ts, src/app/api/sales/route.ts, src/app/api/sales/[id]/route.ts, src/app/api/sales/[id]/void/route.ts |

## Objective

Create the sale service module and its associated API routes, implementing all sale lifecycle operations: creating a completed sale with atomic stock deduction inside a single Prisma interactive transaction, retrieving individual and paginated sales, voiding a sale with full stock restoration and audit logging, and returning shift-level sale aggregates.

## Instructions

### Step 1: Define Input Types and Import Dependencies

At the top of src/lib/services/sale.service.ts, import Prisma, the generated Prisma client instance (db), and Decimal from the decimal.js library. Also import adjustStock from inventory.service.ts, the ConflictError, NotFoundError, and UnauthorizedError classes from the shared error utilities established in Phase 01, and the RBAC permission check utility from the auth utilities built in SubPhase 01.02.

Define a TypeScript interface named CreateSaleLineInput containing: variantId (string), quantity (positive integer minimum 1), and discountPercent (Decimal defaulting to zero if not provided). Define CreateSaleInput containing: cashierId (string), shiftId (string), lines (a non-empty array of CreateSaleLineInput), cartDiscountAmount (Decimal defaulting to zero), authorizingManagerId (optional string), and paymentMethod (PaymentMethod enum value). These explicit types allow the TypeScript compiler to catch mismatches between the UI layer and the service layer at compile time.

### Step 2: Implement createSale

The createSale function accepts tenantId (string) and saleInput (CreateSaleInput). It must execute every database write inside a single Prisma interactive transaction using prisma.$transaction(async (tx) => { ... }). The interactive transaction form — not the batch form — is required here because the result of each write informs the next.

Inside the transaction, proceed through the following sequence of operations.

First, validate the shift. Query the Shift model (via tx) filtering by both id equal to saleInput.shiftId and tenantId equal to the provided tenantId. Confirm the record exists and has status OPEN. If the shift is not found, throw a NotFoundError identifying the shift. If the shift is CLOSED, throw a ConflictError explaining that sales cannot be added to a closed shift.

Second, resolve each variant and its pricing. For every entry in saleInput.lines, query the ProductVariant model (via tx) by variantId, including the parent Product to retrieve the product name, tax rule, and tenantId. Validate that each variant exists, that its parent product belongs to the correct tenant, and that the product is not archived. Build an internal structure mapping each variantId to its resolved variant, product name, retail price, and tax rule. If any variant is not found or belongs to a different tenant, throw a NotFoundError with the specific variantId.

Third, perform line-level financial calculations using decimal.js for every line in the input. Instantiate Decimal from the variant's retailPrice for the unitPrice. Compute lineTotalBeforeDiscount by multiplying unitPrice by a new Decimal representing the integer quantity. Compute discountAmount by multiplying lineTotalBeforeDiscount by the line's discountPercent divided by 100. Compute lineTotalAfterDiscount by subtracting discountAmount from lineTotalBeforeDiscount. Apply the tax calculation: if the product's taxRule is STANDARD_VAT, compute lineTax as lineTotalAfterDiscount multiplied by 0.15; if SSCL, multiply by 0.025; if EXEMPT, lineTax is Decimal(0). Round every derived monetary value to two decimal places using Decimal.ROUND_HALF_UP before use. Accumulate all lineTax values into a running totalTax Decimal.

Fourth, compute the sale-level totals. The subtotal is the sum of all lineTotalAfterDiscount values. Validate that cartDiscountAmount does not exceed the subtotal — throw a validation error if it does. Compute totalAmount as subtotal minus cartDiscountAmount plus totalTax. Round totalAmount and subtotal to two decimal places.

Fifth, validate stock availability for each variant. For each line, query the VariantStockLevel table (the stock tracking model from Phase 2) filtering by variantId and tenantId. If the current available quantity minus the requested line quantity would result in a negative value, and if the tenant's allowNegativeStock setting is false (retrieved by querying the TenantSettings or Tenant model), throw a ConflictError that names the specific variant, its current stock level, and the requested quantity. If allowNegativeStock is true, or if sufficient stock exists, continue.

Sixth, create the Sale record within the transaction with all computed fields populated: subtotal, discountAmount set to cartDiscountAmount, taxAmount set to totalTax, totalAmount, paymentMethod, authorizingManagerId, cashierId, shiftId, tenantId, status set to COMPLETED, and completedAt set to the current date and time.

Seventh, create all SaleLine records within the same transaction. For each line, populate the SaleLine with the sale id, variantId, all three snapshot fields (productNameSnapshot from the product name, variantDescriptionSnapshot assembled from variant attributes, sku from the variant), and all computed financial values (unitPrice, quantity, discountPercent, discountAmount, lineTotalBeforeDiscount, lineTotalAfterDiscount).

Eighth, call adjustStock for each line variant using the transaction client as the database context. Pass quantityDelta as the negative value of the line's quantity and set reason to StockMovementReason.SALE. The ability to pass the transaction client to adjustStock ensures all writes — the sale, the lines, and every stock movement — are part of the same atomic unit. If adjustStock's current signature does not accept a transaction client parameter, add an optional tx parameter to its existing signature before proceeding.

Ninth, return the completed Sale by querying it (via tx) with its lines and cashier included so the caller receives a fully populated response without needing to make a second database round-trip.

### Step 3: Implement getSaleById

The getSaleById function accepts tenantId and saleId. It queries the Sale model filtering by both id and tenantId, and includes related lines (with variant and product details), the cashier User record (id, name, email — no password fields), the authorising manager User record (same limited fields), and the shift reference (id, openedAt, status). Throw a NotFoundError if no sale matching both the id and tenantId is found. Return the fully populated sale object.

### Step 4: Implement getSales

The getSales function accepts tenantId and an optional filters object. The filters object may contain: shiftId (string), cashierId (string), status (SaleStatus enum value), from and to (Date objects for a createdAt range), page (integer defaulting to 1), and limit (integer defaulting to 20 with a maximum cap of 100 enforced in the function body). Construct a Prisma where clause combining tenantId with any provided filters. Execute both a findMany query (with skip and take for pagination, ordered by createdAt descending) and a count query in parallel using Promise.all. Return an object containing the sales array and a total count to allow the caller to compute pagination metadata.

### Step 5: Implement voidSale

The voidSale function accepts tenantId, saleId, and actorId. Before entering a transaction, check that the actor identified by actorId has the pos:void_sale RBAC permission in the relevant tenant. Throw an UnauthorizedError immediately if the permission check fails.

Inside a Prisma transaction: retrieve the sale by tenantId and saleId and confirm it has status COMPLETED. Throw a ConflictError if the sale is already VOIDED or OPEN. Retrieve the sale's shift and confirm its status is OPEN — voiding a sale from a closed shift is not permitted in Phase 3 (returns processing for closed-shift sales is a Phase 4 feature). Update the sale with status VOIDED, voidedById set to actorId, and voidedAt set to now.

For each SaleLine associated with the voided sale, call adjustStock within the transaction with a positive quantityDelta equal to the line's quantity and reason set to StockMovementReason.VOID_REVERSAL. This restores all inventory consumed by the original sale.

Create an AuditLog entry within the same transaction, setting the action field to "SALE_VOIDED", the entityId to the saleId, the actorId to actorId, and the detail field to a JSON-serialised snapshot of the voided sale including its lines, total amounts, cashier information, and the timestamp of the void. Return the updated Sale record.

### Step 6: Implement getShiftSales

The getShiftSales function accepts tenantId and shiftId. Validate that the Shift record exists and belongs to the tenantId before proceeding. Query all Sale records for the given shiftId, filtering to COMPLETED status only for the financial aggregations. Return the full list of non-VOIDED sales alongside a summary object containing: totalSalesCount (count of COMPLETED sales), totalAmount (sum of totalAmount for COMPLETED sales), totalCashSales (sum where paymentMethod is CASH), totalCardSales (sum where paymentMethod is CARD), and totalDiscountGiven (sum of discountAmount across COMPLETED sales). Use Prisma's aggregate function for the summation queries.

### Step 7: Define the Zod Validator and API Routes

Create src/lib/validators/sale.validator.ts. Define a CreateSaleSchema using Zod that validates the complete CreateSaleInput structure: lines must be a non-empty array (minimum one item) where each entry includes a non-empty variantId string, a quantity integer of at least 1, and an optional non-negative discountPercent not exceeding 100. The cartDiscountAmount must be a non-negative number. The paymentMethod must be one of the three PaymentMethod enum values. The shiftId must be a non-empty string.

Create src/app/api/sales/route.ts handling GET (calls getSales with validated query parameters, returns paginated list) and POST (parses and validates the request body with CreateSaleSchema, then calls createSale). Create src/app/api/sales/[id]/route.ts handling GET (calls getSaleById). Create src/app/api/sales/[id]/void/route.ts handling POST (calls voidSale with actorId extracted from the session). All routes must authenticate via NextAuth getServerSession, extract tenantId from the session, and return appropriate HTTP status codes: 409 for ConflictError, 404 for NotFoundError, 403 for UnauthorizedError, and 422 with validation details for Zod failures.

## Expected Output

- src/lib/services/sale.service.ts with all five functions fully implemented and type-safe
- src/lib/validators/sale.validator.ts with CreateSaleSchema
- src/app/api/sales/route.ts, src/app/api/sales/[id]/route.ts, src/app/api/sales/[id]/void/route.ts
- All monetary arithmetic using decimal.js exclusively — no native JavaScript floating-point arithmetic anywhere in the service
- adjustStock in inventory.service.ts updated to accept an optional Prisma transaction client parameter if it does not already do so

## Validation

- Creating a sale with two lines where one product has STANDARD_VAT and the other has EXEMPT produces a taxAmount equal only to 15% of the STANDARD_VAT line total — the EXEMPT line contributes no tax
- Creating a sale for a variant with zero stock and the tenant's allowNegativeStock set to false throws a ConflictError without creating any database records
- A successful createSale call produces exactly one Sale record, two SaleLine records (for a two-line cart), and two StockMovement records (one per line), all within the same database transaction
- Voiding a COMPLETED sale restores both variant stock quantities, creates one AuditLog entry, and transitions the sale to VOIDED status
- Calling getSales with a shiftId filter and a status filter of COMPLETED returns only completed sales belonging to that shift
- Attempting to void a sale from a CLOSED shift throws a ConflictError

## Notes

- The Prisma interactive transaction is non-negotiable here. Using sequential awaits outside a transaction for a set of related writes is a data integrity risk: a server crash or network failure between any two writes would leave the database in a partially written state, producing phantom sales with missing lines or missing stock movements.
- The tax calculation must remain at the line level. Do not simplify it by applying a single rate to the total — doing so would produce incorrect results when a cart mixes items with different tax rules.
- The adjustStock function from Phase 2 was built for inventory operations like purchase receiving and manual adjustments. When adapting it to accept a transaction client, ensure the optional tx parameter is forwarded to every internal Prisma call within adjustStock, not just the first one.
- All ConflictError, NotFoundError, and UnauthorizedError classes should already exist in the shared error utility established in Phase 01. Do not create new error classes for this task.
