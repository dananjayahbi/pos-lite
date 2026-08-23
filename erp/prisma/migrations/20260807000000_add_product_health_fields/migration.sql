-- AlterTable
-- Add Ayurvedic health/usage content fields to products. These are rendered
-- as structured sections on the storefront product detail page.
ALTER TABLE "products" ADD COLUMN "activeIngredients" TEXT;
ALTER TABLE "products" ADD COLUMN "usageInstructions" TEXT;
ALTER TABLE "products" ADD COLUMN "healthBenefits" TEXT;
ALTER TABLE "products" ADD COLUMN "safetyPrecautions" TEXT;
