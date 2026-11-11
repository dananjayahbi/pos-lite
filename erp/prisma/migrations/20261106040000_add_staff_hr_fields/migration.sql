-- HR profile, salary components, and banking/statutory identifiers for staff.
ALTER TABLE "users"
  ADD COLUMN "fullName" TEXT,
  ADD COLUMN "nic" TEXT,
  ADD COLUMN "contactNumber" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "basicSalary" DECIMAL(12,2),
  ADD COLUMN "allowances" DECIMAL(12,2),
  ADD COLUMN "bankName" TEXT,
  ADD COLUMN "bankBranch" TEXT,
  ADD COLUMN "bankAccountNumber" TEXT,
  ADD COLUMN "etfNumber" TEXT,
  ADD COLUMN "epfNumber" TEXT;
