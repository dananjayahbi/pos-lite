-- AlterTable
-- Add a single image to categories so the storefront's category section can
-- display an image per category.
ALTER TABLE "categories" ADD COLUMN "imageUrl" TEXT;
