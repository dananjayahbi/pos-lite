/**
 * Recompute stored shift closures from the same payment legs, returns and cash
 * movements the Z-report uses (ARGUS #108).
 *
 * Historical closures were written before tender totals came from payment legs
 * and before refunds/petty cash were considered, so their stored cash/card/QR,
 * returns and expected cash can disagree with the live Z-report.
 *
 * Usage (from the `erp` folder):
 *   npx tsx scripts/recompute-shift-closures.ts            # dry run, prints diffs
 *   npx tsx scripts/recompute-shift-closures.ts --apply    # writes corrected closures
 */
import Decimal from 'decimal.js';
import { prisma } from '@/lib/prisma';
import { computeShiftClosureFigures } from '@/lib/services/shiftCash.core';

const apply = process.argv.includes('--apply');

function money(value: unknown): string {
  return Number(value?.toString?.() ?? value ?? 0).toFixed(2);
}

async function main() {
  const shifts = await prisma.shift.findMany({
    where: { status: 'CLOSED', closure: { isNot: null } },
    include: { closure: true },
    orderBy: { openedAt: 'asc' },
  });

  let stale = 0;
  for (const shift of shifts) {
    const closure = shift.closure;
    if (!closure) continue;

    const [payments, returns, cashMovements] = await Promise.all([
      prisma.payment.findMany({
        where: { sale: { shiftId: shift.id, tenantId: shift.tenantId, status: 'COMPLETED' } },
        select: { method: true, amount: true },
      }),
      prisma.return.findMany({
        where: {
          tenantId: shift.tenantId,
          createdAt: { gte: shift.openedAt, lte: closure.closedAt },
        },
        select: { refundAmount: true, refundMethod: true },
      }),
      prisma.cashMovement.findMany({
        where: { shiftId: shift.id, tenantId: shift.tenantId },
        select: { amount: true, type: true },
      }),
    ]);

    const figures = computeShiftClosureFigures({
      payments,
      returns,
      cashMovements,
      openingFloat: shift.openingFloat,
    });
    const expectedCash = figures.expectedCash.toDecimalPlaces(2);
    const cashDifference = new Decimal(closure.closingCashCount)
      .minus(expectedCash)
      .toDecimalPlaces(2);

    const before = {
      cash: money(closure.totalCashAmount),
      card: money(closure.totalCardAmount),
      qr: money(closure.totalQrAmount),
      returns: money(closure.totalReturnsAmount),
      expected: money(closure.expectedCash),
      difference: money(closure.cashDifference),
    };
    const after = {
      cash: money(figures.totalCash),
      card: money(figures.totalCard),
      qr: money(figures.totalQr),
      returns: money(figures.totalReturns),
      expected: money(expectedCash),
      difference: money(cashDifference),
    };

    if (JSON.stringify(before) === JSON.stringify(after)) continue;
    stale += 1;
    console.log(`\nShift ${shift.id} (${shift.openedAt.toISOString().slice(0, 10)})`);
    for (const key of Object.keys(before) as Array<keyof typeof before>) {
      if (before[key] !== after[key]) {
        console.log(`  ${key}: ${before[key]} -> ${after[key]}`);
      }
    }

    if (apply) {
      await prisma.shiftClosure.update({
        where: { id: closure.id },
        data: {
          totalCashAmount: figures.totalCash.toNumber(),
          totalCardAmount: figures.totalCard.toNumber(),
          totalQrAmount: figures.totalQr.toNumber(),
          totalReturnsCount: figures.totalReturnsCount,
          totalReturnsAmount: figures.totalReturns.toNumber(),
          expectedCash: expectedCash.toNumber(),
          cashDifference: cashDifference.toNumber(),
        },
      });
    }
  }

  console.log(
    `\n${stale} of ${shifts.length} closed shift(s) ${apply ? 'updated' : 'would be updated'}.`,
  );
  if (!apply && stale > 0) {
    console.log('Re-run with --apply to write the corrected closures.');
  }
}

main()
  .catch((error) => {
    console.error('recompute-shift-closures failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
