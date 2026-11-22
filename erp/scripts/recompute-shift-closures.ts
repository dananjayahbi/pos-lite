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
import {
  computeShiftClosureFigures,
  filterReturnsForShift,
} from '@/lib/services/shiftCash.core';

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

    const closureEnd = shift.closedAt ?? closure.closedAt;
    const [payments, returnRows, cashMovements, cashierShifts] = await Promise.all([
      prisma.payment.findMany({
        where: { sale: { shiftId: shift.id, tenantId: shift.tenantId, status: 'COMPLETED' } },
        select: { method: true, amount: true },
      }),
      // Same attribution as shift.service (ARGUS #109): the shift that
      // recorded the original sale owns the refund. Legacy shiftless sales
      // fall back to the initiator's covering shift, resolved below.
      prisma.return.findMany({
        where: {
          tenantId: shift.tenantId,
          OR: [
            { originalSale: { shiftId: shift.id } },
            {
              originalSale: { shiftId: null },
              initiatedById: shift.cashierId,
              createdAt: { gte: shift.openedAt, lte: closureEnd },
            },
          ],
        },
        select: {
          refundAmount: true,
          refundMethod: true,
          initiatedById: true,
          createdAt: true,
          originalSale: { select: { shiftId: true } },
        },
      }),
      prisma.cashMovement.findMany({
        where: { shiftId: shift.id, tenantId: shift.tenantId },
        select: { amount: true, type: true },
      }),
      prisma.shift.findMany({
        where: { tenantId: shift.tenantId, cashierId: shift.cashierId },
        select: { id: true, cashierId: true, openedAt: true, closedAt: true },
      }),
    ]);

    const returns = filterReturnsForShift(
      returnRows.map((ret) => ({
        refundAmount: ret.refundAmount,
        refundMethod: ret.refundMethod,
        originalSaleShiftId: ret.originalSale.shiftId,
        initiatedById: ret.initiatedById,
        createdAt: ret.createdAt,
      })),
      cashierShifts,
      shift.id,
    );

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
