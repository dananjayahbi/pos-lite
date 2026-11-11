-- Product promotions can now use a fixed LKR amount, mirroring CART_FIXED.
ALTER TYPE "PromotionType" ADD VALUE IF NOT EXISTS 'PRODUCT_FIXED';
