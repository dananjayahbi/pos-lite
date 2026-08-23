-- Customer order payment model: add payment method/status + gateway ref to deliveries
CREATE TYPE "OrderPaymentMethod" AS ENUM ('COD', 'CARD');
CREATE TYPE "OrderPaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

ALTER TABLE "deliveries" ADD COLUMN "paymentMethod" "OrderPaymentMethod" NOT NULL DEFAULT 'COD';
ALTER TABLE "deliveries" ADD COLUMN "paymentStatus" "OrderPaymentStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "deliveries" ADD COLUMN "payhereOrderId" TEXT;

-- Backfill: existing website-checkout deliveries were COD.
UPDATE "deliveries"
SET "paymentMethod" = 'COD', "paymentStatus" = 'PENDING'
WHERE "source" = 'WEBSITE_CHECKOUT' AND "paymentMethod" IS NULL;
