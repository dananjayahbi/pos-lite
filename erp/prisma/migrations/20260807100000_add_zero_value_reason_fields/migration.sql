-- Session 17 — Zero-Value Order Verification (docs 33, 34)
-- Adds the zero-value reason enum + linkage field to the Sale model, plus a
-- NONE payment method used when a sale completes with no money changing hands.

-- Doc 33 / 34: new reason enum for zero-value sales.
CREATE TYPE "ZeroValueReason" AS ENUM ('BANK_PAYMENT', 'PRODUCT_REPLACEMENT', 'COMPLIMENTARY_GIFT');

-- Zero-value sales use the NONE payment method (no cash/card/QR leg recorded).
ALTER TYPE "PaymentMethod" ADD VALUE 'NONE';

-- Doc 33: why the sale was zero-valued.
ALTER TABLE "sales" ADD COLUMN "zeroValueReason" "ZeroValueReason";

-- Doc 34: original order reference for PRODUCT_REPLACEMENT sales.
ALTER TABLE "sales" ADD COLUMN "zeroValueLinkedOrderRef" TEXT;

-- Dashboard (doc 35) queries zero-value sales within a tenant + date window.
CREATE INDEX "sales_tenantId_totalAmount_createdAt_idx" ON "sales"("tenantId", "totalAmount", "createdAt");
