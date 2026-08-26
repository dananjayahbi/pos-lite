-- AlterEnum
CREATE TYPE "DeductionAuditStatus" AS ENUM ('COMPLIANT', 'OVER_CHARGED', 'UNDER_CHARGED');

-- AlterEnum
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'ACCEPTED', 'REJECTED', 'CLOSED');

-- AlterTable: net-payout + contract-audit fields on ledger entries
ALTER TABLE "reconciliation_ledger_entries" ADD COLUMN "expectedNetPayout" DECIMAL(12,2);
ALTER TABLE "reconciliation_ledger_entries" ADD COLUMN "codCommissionAmount" DECIMAL(12,2);
ALTER TABLE "reconciliation_ledger_entries" ADD COLUMN "vatAmount" DECIMAL(12,2);
ALTER TABLE "reconciliation_ledger_entries" ADD COLUMN "auditStatus" "DeductionAuditStatus";
ALTER TABLE "reconciliation_ledger_entries" ADD COLUMN "expectedDeduction" DECIMAL(12,2);
ALTER TABLE "reconciliation_ledger_entries" ADD COLUMN "actualDeduction" DECIMAL(12,2);
ALTER TABLE "reconciliation_ledger_entries" ADD COLUMN "deductionVariance" DECIMAL(12,2);

-- CreateIndex
CREATE INDEX "reconciliation_ledger_entries_tenantId_auditStatus_idx" ON "reconciliation_ledger_entries"("tenantId", "auditStatus");

-- CreateTable
CREATE TABLE "reconciliation_disputes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ledgerEntryId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "disputedAmount" DECIMAL(12,2) NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
    "resolutionNote" TEXT,
    "openedById" TEXT NOT NULL,
    "resolvedById" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reconciliation_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reconciliation_disputes_ledgerEntryId_key" ON "reconciliation_disputes"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "reconciliation_disputes_tenantId_status_idx" ON "reconciliation_disputes"("tenantId", "status");

-- CreateIndex
CREATE INDEX "reconciliation_disputes_ledgerEntryId_idx" ON "reconciliation_disputes"("ledgerEntryId");

-- AddForeignKey
ALTER TABLE "reconciliation_disputes" ADD CONSTRAINT "reconciliation_disputes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_disputes" ADD CONSTRAINT "reconciliation_disputes_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "reconciliation_ledger_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_disputes" ADD CONSTRAINT "reconciliation_disputes_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_disputes" ADD CONSTRAINT "reconciliation_disputes_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
