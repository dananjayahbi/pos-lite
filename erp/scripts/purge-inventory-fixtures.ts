/**
 * Inspect (and deliberately remove) QA inventory fixtures (ARGUS #155).
 *
 * The live tenant's catalogue was dominated by `QA Replacement Fixture …`
 * products plus fixture stock movements, stock takes and batches. This CLI is
 * opt-in and does **not** run from the app or the seed:
 *
 *   npx tsx scripts/purge-inventory-fixtures.ts
 *   npx tsx scripts/purge-inventory-fixtures.ts --tenant=<id>
 *   npx tsx scripts/purge-inventory-fixtures.ts --tenant=<id> --actor=<userId> --apply
 *
 * Read-only unless `--apply` is passed. `--apply` requires an explicit
 * `--tenant` and `--actor`, and only soft-deletes **live** products whose name
 * starts with `QA Replacement Fixture` (through the normal
 * `softDeleteProduct` service, so the audit log and the "no stock on hand"
 * guard apply). The append-only stock ledger, stock-take sessions and batches
 * are never deleted or rewritten — already-deleted fixtures and their history
 * are listed for a human to review.
 */
import { prisma } from '@/lib/prisma';
import { softDeleteProduct } from '@/lib/services/product.service';
import {
  QA_FIXTURE_NAME_PREFIX,
  summarizeQaFixtures,
} from '@/lib/products/qaFixtureHygiene.core';

const apply = process.argv.includes('--apply');
const tenantArg = process.argv.find((arg) => arg.startsWith('--tenant='));
const tenantId = tenantArg?.slice('--tenant='.length).trim() || undefined;
const actorArg = process.argv.find((arg) => arg.startsWith('--actor='));
const actorId = actorArg?.slice('--actor='.length).trim() || undefined;

async function main() {
  if (apply && (!tenantId || !actorId)) {
    console.error('Refusing to apply without --tenant=<id> and --actor=<userId>.');
    process.exitCode = 1;
    return;
  }

  const products = await prisma.product.findMany({
    where: tenantId ? { tenantId } : {},
    select: { id: true, name: true, deletedAt: true },
    orderBy: { name: 'asc' },
  });

  const summary = summarizeQaFixtures(products);
  const fixtureIds = [...summary.liveIds, ...summary.deletedIds];

  const variants = await prisma.productVariant.findMany({
    where: { productId: { in: fixtureIds } },
    select: { id: true, productId: true, stockQuantity: true },
  });
  const variantIds = variants.map((variant) => variant.id);

  const [movementCount, stockTakeItemCount, batchCount] = await Promise.all([
    prisma.stockMovement.count({ where: { variantId: { in: variantIds } } }),
    prisma.stockTakeItem.count({ where: { variantId: { in: variantIds } } }),
    prisma.batchTracking.count({ where: { variantId: { in: variantIds } } }),
  ]);

  const unitsOnHand = variants.reduce((total, variant) => total + variant.stockQuantity, 0);

  console.log(`QA fixture prefix: "${QA_FIXTURE_NAME_PREFIX}"`);
  console.log(`Products scanned: ${products.length}`);
  console.log(
    `Fixtures: ${summary.total} (${summary.live} live, ${summary.deleted} soft-deleted)`,
  );
  console.log(
    `Related rows: ${variants.length} variants, ${movementCount} stock movements, ` +
      `${stockTakeItemCount} stock-take items, ${batchCount} batch trackings`,
  );
  console.log(`Units still on hand: ${unitsOnHand}`);
  console.log(`\nLive fixtures${apply ? ' (soft-delete targets)' : ' (would be soft-deleted with --apply)'}:`);

  for (const product of products.filter(
    (row) => row.deletedAt == null && summary.liveIds.includes(row.id),
  )) {
    console.log(`  - ${product.id} ${product.name}`);
  }

  if (summary.deletedIds.length > 0) {
    console.log('\nAlready soft-deleted fixtures (history retained; review manually):');
    for (const product of products.filter((row) => summary.deletedIds.includes(row.id))) {
      console.log(`  - ${product.id} ${product.name}`);
    }
  }

  if (!apply) {
    console.log(
      '\nNo data was modified. Re-run with --tenant=<id> --actor=<userId> --apply to ' +
        'soft-delete the live fixtures. Zero their stock first if the guard blocks a row.',
    );
    return;
  }

  let deleted = 0;
  for (const id of summary.liveIds) {
    try {
      await softDeleteProduct(tenantId as string, id, actorId as string);
      deleted += 1;
      console.log(`  DELETED ${id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`  SKIPPED ${id}: ${message}`);
    }
  }
  console.log(`\nSoft-deleted ${deleted} of ${summary.liveIds.length} live fixture(s).`);
  console.log('The stock ledger, stock takes and batches were left untouched.');
}

main()
  .catch((error) => {
    console.error('purge-inventory-fixtures failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
