/* eslint-disable no-console -- one-shot CLI: prints exactly what it generated */
/**
 * Backfills 256×256 WebP thumbnails for product images uploaded before
 * Feature update #14.
 *
 * New uploads get both versions from POST /api/upload. This script closes the
 * historical gap:
 *   - products with a mainImageUrl but no mainImageThumbnailUrl
 *   - variants with imageUrls but an empty thumbnailImageUrls (parallel array)
 *
 * Usage (from `erp/`):
 *
 *   node --env-file=.env --import tsx scripts/backfill-image-thumbnails.ts --dry-run
 *   node --env-file=.env --import tsx scripts/backfill-image-thumbnails.ts
 *
 * Safe to re-run: only rows missing thumbnails are touched. Images that cannot
 * be downloaded are reported and skipped; consumers fall back to the full URL.
 */
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client';
import { createThumbnail } from '../src/lib/image-thumbnail';
import { uploadFile } from '../src/lib/storage';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes('--dry-run');

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function makeThumbnailUrl(tenantId: string, sourceUrl: string): Promise<string> {
  const bytes = await downloadImage(sourceUrl);
  const thumbnail = await createThumbnail(bytes);
  const result = await uploadFile(
    thumbnail,
    `${tenantId}/thumbnails/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    {
      contentType: 'image/webp',
      folder: 'variant-images',
      maxSizeBytes: 2 * 1024 * 1024,
    },
  );
  return result.url;
}

async function main() {
  const products = await prisma.product.findMany({
    where: {
      mainImageUrl: { not: null },
      mainImageThumbnailUrl: null,
      deletedAt: null,
    },
    select: { id: true, tenantId: true, name: true, mainImageUrl: true },
  });

  const variants = await prisma.productVariant.findMany({
    where: {
      deletedAt: null,
      thumbnailImageUrls: { isEmpty: true },
      NOT: { imageUrls: { isEmpty: true } },
    },
    select: { id: true, tenantId: true, sku: true, imageUrls: true },
  });

  console.log(
    `${DRY_RUN ? '[dry-run] ' : ''}${products.length} product main image(s), ${
      variants.length
    } variant image set(s) need thumbnails.`,
  );

  let productCount = 0;
  for (const product of products) {
    if (!product.mainImageUrl) continue;
    try {
      if (DRY_RUN) {
        console.log(`[dry-run] product ${product.name}`);
        productCount++;
        continue;
      }
      const thumbnailUrl = await makeThumbnailUrl(product.tenantId, product.mainImageUrl);
      await prisma.product.update({
        where: { id: product.id },
        data: { mainImageThumbnailUrl: thumbnailUrl },
      });
      productCount++;
      console.log(`product ${product.name} → ${thumbnailUrl}`);
    } catch (error) {
      console.warn(
        `product ${product.name} skipped: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  let variantCount = 0;
  for (const variant of variants) {
    try {
      if (DRY_RUN) {
        console.log(`[dry-run] variant ${variant.sku} (${variant.imageUrls.length} image(s))`);
        variantCount++;
        continue;
      }
      // Keep the array index-aligned with imageUrls; reuse a successfully
      // generated thumbnail for duplicate URLs within the same variant.
      const cache = new Map<string, string>();
      const thumbnails: string[] = [];
      for (const url of variant.imageUrls) {
        const cached = cache.get(url);
        if (cached) {
          thumbnails.push(cached);
          continue;
        }
        try {
          const thumbnailUrl = await makeThumbnailUrl(variant.tenantId, url);
          cache.set(url, thumbnailUrl);
          thumbnails.push(thumbnailUrl);
        } catch {
          // Keep alignment: fall back to the full URL for this slot.
          thumbnails.push(url);
        }
      }
      await prisma.productVariant.update({
        where: { id: variant.id },
        data: { thumbnailImageUrls: thumbnails },
      });
      variantCount++;
      console.log(`variant ${variant.sku} → ${thumbnails.length} thumbnail(s)`);
    } catch (error) {
      console.warn(
        `variant ${variant.sku} skipped: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  console.log(
    `\n${DRY_RUN ? 'Would backfill' : 'Backfilled'} ${productCount} product(s) and ${variantCount} variant(s).`,
  );
}

main()
  .catch((error) => {
    console.error('Thumbnail backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
