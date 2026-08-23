-- AlterTable
-- Add productSource to Product with a default so existing rows backfill to MANUFACTURED.
-- Uses a NOT NULL column with a server default to avoid blocking writes on large tables.

-- CreateEnum
CREATE TYPE "ProductSource" AS ENUM ('MANUFACTURED', 'TRADED');

-- AlterTable
ALTER TABLE "products"
    ADD COLUMN "productSource" "ProductSource" NOT NULL DEFAULT 'MANUFACTURED';
