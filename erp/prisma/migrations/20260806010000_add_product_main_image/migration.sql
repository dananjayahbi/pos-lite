-- AlterTable
-- Add a single representative "main image" to products so storefront product
-- cards can show one image even when a product has multiple variants, each
-- with its own imageUrls.
ALTER TABLE "products" ADD COLUMN "mainImageUrl" TEXT;
