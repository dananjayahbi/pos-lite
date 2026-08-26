-- AlterEnum
CREATE TYPE "ReconciliationMatchMethod" AS ENUM ('WAYBILL', 'ORDER_REF', 'BARCODE', 'UNMATCHED', 'AMBIGUOUS');

-- AlterEnum
CREATE TYPE "DiscrepancyCategory" AS ENUM ('UNPAID', 'UNDERPAID', 'UNAUTHORIZED_DEDUCTION', 'OVER_RECEIVED', 'UNKNOWN');

-- AlterTable
ALTER TABLE "reconciliation_ledger_entries" ADD COLUMN "matchMethod" "ReconciliationMatchMethod" NOT NULL DEFAULT 'UNMATCHED';
ALTER TABLE "reconciliation_ledger_entries" ADD COLUMN "discrepancyCategory" "DiscrepancyCategory";
ALTER TABLE "reconciliation_ledger_entries" ADD COLUMN "discrepancyAmount" DECIMAL(12,2);

-- CreateIndex
CREATE INDEX "reconciliation_ledger_entries_tenantId_matchMethod_idx" ON "reconciliation_ledger_entries"("tenantId", "matchMethod");
CREATE INDEX "reconciliation_ledger_entries_tenantId_discrepancyCategory_idx" ON "reconciliation_ledger_entries"("tenantId", "discrepancyCategory");
