# Task 04.02.04 — Build Commission Service Layer

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.02.04 |
| SubPhase | 04.02 — Staff, Promotions and Expenses |
| Complexity | Very High |
| Estimated Effort | 4–6 hours |
| Depends On | 04.02.01 (CommissionRecord, CommissionPayout models), Phase 03 Sale and Return API routes |
| Produces | commission.service.ts, updated sale completion handler, updated return completion handler |
| Owner Role | Full-Stack Developer |

---

## Objective

Implement the commission service layer that automatically records commission earnings when a sale is completed, adjusts commissions on returns, aggregates unpaid totals, and processes monthly or period-based payouts. This service is the financial backbone of the staff incentive system.

---

## Context

The commission lifecycle has four stages. First, when a sale is completed with a salespersonId, a CommissionRecord is created as a side effect. Second, when a return is processed against a sale that had a salespersonId, a negative CommissionRecord is created to reverse part or all of the original earning. Third, at any time a Manager can query the unpaid total for a staff member. Fourth, a Manager can initiate a payout that closes all unpaid records for a period into a CommissionPayout record. The service must be stateless and importable by both the sale API and the return API without circular dependencies.

---

## Instructions

### Step 1: Create the Service File and Type Definitions

Create src/lib/services/commission.service.ts. Define and export a TypeScript interface CommissionCreateInput that carries tenantId, saleId, userId, baseAmount (Decimal), and commissionRate (Decimal). Define CommissionPayoutInput carrying tenantId, userId, periodStart (Date), periodEnd (Date), and authorizedById. Define CommissionSummaryResult carrying userId, userName, unpaidCount, totalUnpaid (Decimal), totalEarned (Decimal). All monetary fields use the Prisma Decimal type, imported from @prisma/client.

### Step 2: Implement createCommissionRecord

Create an exported async function createCommissionRecord(input: CommissionCreateInput) that performs the following steps. First, validate that the commissionRate is between 0 and 100 — throw a typed CommissionError if out of range. Second, compute earnedAmount as baseAmount multiplied by (commissionRate divided by 100), using Decimal arithmetic (no native JavaScript numbers). Third, use prisma.commissionRecord.create to insert the record with the computed earnedAmount and isPaid set to false. Return the created record. This function must be callable inside a Prisma transaction (accept an optional Prisma transactional client as a second parameter).

### Step 3: Implement createNegativeCommissionRecord

Create an exported async function createNegativeCommissionRecord that accepts a returnId (the Return record's ID) and finds the sale associated with the return via the Return.saleId relation. If the original sale has a salespersonId, look up that user's current commissionRate on their User record. If no commissionRate is set, skip and return null. Compute the refundAmount from the Return record's total. Calculate the negative earnedAmount as the refund amount multiplied by the rate, then negate it (multiply by -1). Call prisma.commissionRecord.create with the negated earnedAmount, the saleId of the original sale, and isPaid set to false. Return the created record or null. Document that negative records offset but do not delete the original positive record to preserve the full audit trail.

### Step 4: Implement getCommissionsForUser

Create an exported async function getCommissionsForUser that accepts tenantId, userId, page (default 1), and pageSize (default 20) as parameters. Query CommissionRecord where tenantId and userId match, include the related Sale's reference number, and order by createdAt descending. Return a paginated result object containing the records array, totalCount, totalPages, and the current page. Each record in the result must include the earnedAmount formatted as a Decimal and an isCredited boolean (true when earnedAmount is negative) to simplify rendering in the UI.

### Step 5: Implement getUnpaidTotal

Create an exported async function getUnpaidTotal(tenantId: string, userId: string) that uses prisma.commissionRecord.aggregate to sum the earnedAmount for all records where isPaid is false, tenantId matches, and userId matches. Return the sum as a Decimal. Return Decimal zero if no unpaid records exist — never return null or undefined for a monetary sum. Also return the count of unpaid records as a second value in a plain object for display purposes.

### Step 6: Implement createCommissionPayout

Create an exported async function createCommissionPayout(input: CommissionPayoutInput). This function must execute inside a Prisma interactive transaction. Within the transaction, perform the following steps in order: query all unpaid CommissionRecord entries for the user where isPaid is false and createdAt falls between periodStart and periodEnd; if no records are found, throw a CommissionError with the message "No unpaid commission records found for the specified period"; sum the earnedAmount of all found records to compute totalEarned; create a CommissionPayout record with the computed totalEarned, paidAt set to now, and all provided inputs; update all found CommissionRecord entries to set isPaid to true and link the commissionPayoutId field to the newly created CommissionPayout id; return the CommissionPayout record. If the transaction fails for any reason, Prisma will roll back all changes atomically.

### Step 7: Implement getCommissionSummaryForTenant

Create an exported async function getCommissionSummaryForTenant(tenantId: string, periodStart: Date, periodEnd: Date) for use on the commissions reports page. This function queries all CommissionRecord entries for the tenant in the specified period, groups results by userId, and returns an array of CommissionSummaryResult objects. Use prisma.commissionRecord.groupBy with _sum on earnedAmount and a filter on isPaid false for unpaid data, then join with User names in a second query, merging the results by userId in application code. Return the results sorted by totalEarned descending.

### Step 8: Integrate with the Sale Completion API

Open the POST /api/sales route handler (from Phase 03). After the sale record is successfully committed, add a try-catch block that calls createCommissionRecord if sale.salespersonId is not null. Pass the sale's salespersonId as userId, the sale's totalAmount as baseAmount, and the User's current commissionRate fetched before the sale transaction begins. Log a warning (not an error) if the commission creation fails — this prevents a commission write error from voiding a completed sale, which would be a worse outcome for the operator.

### Step 9: Integrate with the Return Completion API

Open the POST /api/returns route handler (from Phase 03). After the return record is successfully committed, add a try-catch block that calls createNegativeCommissionRecord with the newly created return's ID. Log a warning if the call fails, consistent with the pattern from Step 8.

---

## Expected Output

- src/lib/services/commission.service.ts exports the six functions described above
- Sale completion creates a CommissionRecord for any sale with a salespersonId
- Return completion creates a negative CommissionRecord for any return against a sale that had a salespersonId
- createCommissionPayout commits all matching records in a single atomic transaction
- getCommissionSummaryForTenant returns per-staff aggregates with correct totals

---

## Validation

- Complete a sale assigned to a CASHIER who has a commissionRate of 5.00 — confirm a CommissionRecord is created with earnedAmount equal to totalAmount multiplied by 0.05
- Process a return against that sale — confirm a negative CommissionRecord is created whose earnedAmount is negative and whose absolute value equals refundAmount multiplied by 0.05
- Call getUnpaidTotal for the cashier — confirm the returned sum equals the net of the positive and negative records
- Call createCommissionPayout covering a period that includes both records — confirm the CommissionPayout record is created, both CommissionRecord entries are marked isPaid true, and the totalEarned on the payout equals the net sum
- Call createCommissionPayout for the same period again — confirm a CommissionError is thrown with "No unpaid commission records found"

---

## Notes

- All arithmetic on monetary values must use the Prisma Decimal class methods (toNumber is forbidden for intermediate calculations). Use Decimal addition, multiplication, and division methods directly.
- The side-effect pattern (commission creation after sale commit) is intentional. Commission creation should never prevent a sale from being recorded. Errors in commission writing should alert operations staff via the audit log, not roll back the sale.
- If a User has a null commissionRate, createCommissionRecord should be skipped entirely — do not create a zero-amount record, as this would pollute the commission history view with noise.
