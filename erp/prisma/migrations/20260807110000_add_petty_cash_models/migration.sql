-- Session 18 — Standalone Petty Cash (docs 36, 37, 38)
-- 1) Extend ExpenseCategory with petty-cash categories (doc 37)
-- 2) New standalone PettyCashFund model (doc 36)
-- 3) Link expenses to a fund (doc 36 Step 4)

-- Add petty-cash-specific expense categories (doc 37 Step 1)
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'STAFF_MEALS';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'TEA_SUGAR';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'OFFICE_STATIONERY';
ALTER TYPE "ExpenseCategory" ADD VALUE IF NOT EXISTS 'TRAVEL';

-- Standalone petty-cash fund (doc 36 Step 1)
CREATE TABLE "petty_cash_funds" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Main Petty Cash',
  "currency" TEXT NOT NULL DEFAULT 'LKR',
  "openingBalance" DECIMAL(12,2) NOT NULL,
  "currentBalance" DECIMAL(12,2) NOT NULL,
  "lowBalanceThreshold" DECIMAL(12,2),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "activeCategories" "ExpenseCategory"[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "petty_cash_funds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "petty_cash_funds_tenantId_idx" ON "petty_cash_funds"("tenantId");

-- Link expenses to a fund (doc 36 Step 4)
ALTER TABLE "expenses" ADD COLUMN "pettyCashFundId" TEXT;

ALTER TABLE "expenses" ADD CONSTRAINT "expenses_pettyCashFundId_fkey"
  FOREIGN KEY ("pettyCashFundId") REFERENCES "petty_cash_funds"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "expenses_pettyCashFundId_idx" ON "expenses"("pettyCashFundId");
