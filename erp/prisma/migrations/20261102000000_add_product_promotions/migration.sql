-- Product-wise promotions: a percentage discount scoped to one product
-- (all of that product's variants), alongside the existing cart- and
-- category-level promotion types.

-- AlterEnum
ALTER TYPE "PromotionType" ADD VALUE IF NOT EXISTS 'PRODUCT_PERCENTAGE';

-- AlterTable
ALTER TABLE "promotions" ADD COLUMN "targetProductId" TEXT;

-- CreateIndex
CREATE INDEX "promotions_targetProductId_idx" ON "promotions"("targetProductId");

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_targetProductId_fkey" FOREIGN KEY ("targetProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
