-- AlterEnum (append)
ALTER TYPE "PaymentMethod" ADD VALUE 'LANKAQR';
ALTER TYPE "PaymentLegMethod" ADD VALUE 'LANKAQR';

-- AlterTable
ALTER TABLE "shift_closures" ADD COLUMN "totalQrAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
