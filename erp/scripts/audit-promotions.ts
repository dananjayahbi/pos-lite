/**
 * Audit promotion data hygiene (ARGUS #68).
 *
 * Read-only. Lists active promotions with no date window (open-ended), BOGO/Mix
 * rows with no target (never applicable), and promotions expiring within 7 days.
 *
 *   npx tsx scripts/audit-promotions.ts
 *   npx tsx scripts/audit-promotions.ts --tenant=<id>
 *
 * No data is modified. Clean-up (deactivating a campaign or adding dates/targets)
 * stays an explicit operator action in the Promotions UI.
 */
import { prisma } from '@/lib/prisma';
import { auditPromotions } from '@/lib/services/promotionHygiene.core';

const tenantArg = process.argv.find((arg) => arg.startsWith('--tenant='));
const tenantId = tenantArg?.slice('--tenant='.length).trim() || undefined;

function line(row: { name: string; type: string }): string {
  return `${row.name} [${row.type}]`;
}

async function main() {
  const promotions = await prisma.promotion.findMany({
    where: tenantId ? { tenantId } : {},
    orderBy: { createdAt: 'asc' },
  });

  const hygiene = auditPromotions(promotions);

  console.log(`Promotions audited: ${promotions.length}`);
  console.log(`\nOpen-ended active promotions (apply until deactivated): ${hygiene.openEnded.length}`);
  for (const row of hygiene.openEnded) console.log(`  - ${line(row)}`);

  console.log(`\nBOGO/Mix promotions with no target (never applicable): ${hygiene.missingTarget.length}`);
  for (const row of hygiene.missingTarget) console.log(`  - ${line(row)}`);

  console.log(`\nActive promotions expiring within 7 days: ${hygiene.expiringSoon.length}`);
  for (const row of hygiene.expiringSoon) {
    console.log(`  - ${line(row)} ends ${new Date(row.endsAt as string).toISOString().slice(0, 10)}`);
  }

  console.log('\nNo data was modified. Review the open-ended rows in Promotions if they are not intentional.');
}

main()
  .catch((error) => {
    console.error('audit-promotions failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
