-- Feature update #14: dual image versions (full + thumbnail)
--
-- products.mainImageThumbnailUrl   256x256 WebP for POS/inventory icons
-- product_variants.thumbnailImageUrls  parallel to imageUrls, same purpose

ALTER TABLE "products"
  ADD COLUMN "mainImageThumbnailUrl" TEXT;

ALTER TABLE "product_variants"
  ADD COLUMN "thumbnailImageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
