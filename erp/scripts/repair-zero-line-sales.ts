/* eslint-disable no-console -- one-shot repair CLI: prints exactly what it changed */
/**
 * Repairs zero-line COMPLETED sales (ARGUS #76).
 *
 * The legacy appointment conversion inserted bare COMPLETED CASH sales with a
 * total but no `sale_lines` and no `payments` — revenue with no goods and no
 * tender. The conversion now always writes a service line, and
 * `assertCompletedSaleShape` rejects the shape at the sale service. This script
 * closes the historical gap.
 *
 * Default (dry run) only lists suspects; it never writes. Pass `--apply` to
 * void them. Only rows with NO lines, NO payments, NO completed returns and NO
 * payment-account entries are touched — those are safe to void with a minimal
 * `status = VOIDED` (there is no stock or ledger to reverse). Anything with a
 * side effect is skipped and reported for manual review.
 *
 *   node --env-file=.env --import tsx scripts/repair-zero-line-sales.ts
 *   node --env-file=.env --import tsx scripts/repair-zero-line-sales.ts --apply
 *   node --env-file=.env --import tsx scripts/repair-zero-line-sales.ts --tenant=<tenantId> --apply
 *
 * This script is never run automatically (seed/import paths do not call it).
 */
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const APPLY = process.argv.includes('--apply');
const TENANT_ID = process.argv
  .find((arg) => arg.startsWith('--tenant='))
  ?.slice('--tenant='.length);

interface Candidate {
  id: string;
  tenantId: string;
  totalAmount: unknown;
  paymentMethod: string | null;
  saleDate: Date | null;
  createdAt: Date;
  cashierId: string;
  shiftId: string | null;
}

async function listCandidates(): Promise<Candidate[]> {
  return prisma.sale.findMany({
    where: {
      status: 'COMPLETED',
      lines: { none: {} },
      payments: { none: {} },
      ...(TENANT_ID ? { tenantId: TENANT_ID } : {}),
    },
    select: {
      id: true,
      tenantId: true,
      totalAmount: true,
      paymentMethod: true,
      saleDate: true,
      createdAt: true,
      cashierId: true,
      shiftId: true,
    },
    orderBy: [{ tenantId: 'asc' }, { createdAt: 'asc' }],
  });
}

async function main() {
  const candidates = await listCandidates();

  if (candidates.length === 0) {
    console.log('No zero-line completed sales found. Nothing to do.');
    return;
  }

  const ids = candidates.map((sale) => sale.id);

  // Anything that already moved money or stock makes a bare status flip unsafe.
  const [completedReturns, accountEntries] = await Promise.all([
    prisma.return.findMany({
      where: { originalSaleId: { in: ids }, status: 'COMPLETED' },
      select: { originalSaleId: true },
    }),
    prisma.paymentAccountEntry.findMany({
      where: { source: 'SALE', sourceId: { in: ids } },
      select: { sourceId: true },
    }),
  ]);
  const hasReturns = new Set(completedReturns.map((row) => row.originalSaleId));
  const hasEntries = new Set(accountEntries.map((row) => row.sourceId));

  const safe: Candidate[] = [];
  const skipped: Candidate[] = [];
  for (const sale of candidates) {
    if (hasReturns.has(sale.id) || hasEntries.has(sale.id)) {
      skipped.push(sale);
    } else {
      safe.push(sale);
    }
  }

  console.log(
    `${APPLY ? 'Repair' : 'Dry run'}: ${candidates.length} zero-line completed sale(s) found ` +
      `(${safe.length} agent-safe, ${skipped.length} need manual review).`,
  );
  console.log('');
  for (const sale of candidates) {
    const reasons = [
      hasReturns.has(sale.id) ? 'has completed returns' : null,
      hasEntries.has(sale.id) ? 'has payment-account entries' : null,
    ].filter(Boolean);
    console.log(
      [
        sale.id,
        sale.tenantId,
        `total=${String(sale.totalAmount)}`,
        `method=${sale.paymentMethod ?? 'NULL'}`,
        `date=${(sale.saleDate ?? sale.createdAt).toISOString().slice(0, 10)}`,
        `shift=${sale.shiftId ?? 'none'}`,
        reasons.length > 0 ? `SKIP: ${reasons.join(', ')}` : 'voidable',
      ].join('  '),
    );
  }
  console.log('');

  if (!APPLY) {
    console.log('Dry run only - no rows were changed. Re-run with --apply to void the sale(s).');
    return;
  }

  let voided = 0;
  for (const sale of safe) {
    const changed = await prisma.$transaction(async (tx) => {
      const updated = await tx.sale.updateMany({
        where: { id: sale.id, status: 'COMPLETED' },
        data: { status: 'VOIDED', voidedAt: new Date() },
      });
      if (updated.count !== 1) return false;

      await tx.auditLog.create({
        data: {
          tenantId: sale.tenantId,
          actorId: null,
          actorRole: 'SYSTEM',
          entityType: 'Sale',
          entityId: sale.id,
          action: 'SALE_VOIDED',
          before: {
            status: 'COMPLETED',
            lineCount: 0,
            paymentCount: 0,
            totalAmount: String(sale.totalAmount),
          },
          after: {
            status: 'VOIDED',
            reason: 'ZERO_LINE_COMPLETED_SALE',
            repairedBy: 'scripts/repair-zero-line-sales.ts',
          },
        },
      });
      return true;
    });

    if (changed) {
      voided += 1;
      console.log(`VOIDED ${sale.id} (${String(sale.totalAmount)})`);
    } else {
      console.log(`SKIPPED ${sale.id} - no longer COMPLETED when updated`);
    }
  }

  console.log('');
  console.log(`Done: ${voided} sale(s) voided, ${skipped.length} skipped for manual review.`);
}

main()
  .catch((error) => {
    console.error('Repair failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
