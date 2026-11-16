/* eslint-disable no-console -- one-shot CLI: prints exactly what it changed */
/**
 * Backfills a barcode onto every product variant that has none.
 *
 * Why: client requirement 03 ("the barcode for the product will be generated and
 * saved when we create the product … for the currently available products, add
 * a barcode as well"). New variants are handled by
 * `product.service.createProductVariants`; this script closes the historical
 * gap for data seeded or imported before that rule existed.
 *
 * Safe to re-run: it only touches rows whose barcode is NULL or empty.
 *
 *   node --env-file=.env --import tsx scripts/backfill-barcodes.ts
 *   node --env-file=.env --import tsx scripts/backfill-barcodes.ts --dry-run
 */
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client';
import { generateBarcode } from '../src/lib/barcode';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const missing = await prisma.productVariant.findMany({
    where: {
      OR: [{ barcode: null }, { barcode: '' }],
    },
    select: { id: true, tenantId: true, sku: true },
    orderBy: [{ tenantId: 'asc' }, { createdAt: 'asc' }],
  });

  if (missing.length === 0) {
    console.log('All product variants already have a barcode. Nothing to do.');
    return;
  }

  const tenantIds = [...new Set(missing.map((v) => v.tenantId))];
  // Uniqueness is per tenant (`@@unique([tenantId, barcode])`), so the used set
  // is tracked per tenant — including soft-deleted rows, which still occupy
  // the constraint.
  const usedByTenant = new Map<string, Set<string>>(
    tenantIds.map((tenantId) => [tenantId, new Set<string>()]),
  );

  const existing = await prisma.productVariant.findMany({
    where: { tenantId: { in: tenantIds }, barcode: { not: null } },
    select: { tenantId: true, barcode: true },
  });
  for (const row of existing) {
    if (row.barcode) usedByTenant.get(row.tenantId)?.add(row.barcode);
  }

  let updated = 0;
  for (const variant of missing) {
    const used = usedByTenant.get(variant.tenantId) ?? new Set<string>();
    let barcode = generateBarcode();
    while (used.has(barcode)) barcode = generateBarcode();

    if (!DRY_RUN) {
      await prisma.productVariant.update({
        where: { id: variant.id },
        data: { barcode },
      });
    }

    used.add(barcode);
    usedByTenant.set(variant.tenantId, used);
    updated++;
    console.log(`${DRY_RUN ? '[dry-run] ' : ''}${variant.sku} → ${barcode}`);
  }

  console.log(
    `\n${DRY_RUN ? 'Would backfill' : 'Backfilled'} ${updated} variant${
      updated === 1 ? '' : 's'
    } across ${tenantIds.length} tenant${tenantIds.length === 1 ? '' : 's'}.`,
  );
}

main()
  .catch((error) => {
    console.error('Barcode backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
