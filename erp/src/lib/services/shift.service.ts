import Decimal from 'decimal.js';
import { prisma } from '@/lib/prisma';
import type { ShiftStatus, SaleStatus, ReturnRefundMethod } from '@/generated/prisma/client';
import { sumPaymentBreakdown } from '@/lib/services/paymentBreakdown';
import {
  computeExpectedCash,
  filterReturnsForShift,
  sumShiftCashMovements,
  sumShiftRefunds,
  type ShiftRefundRow,
} from '@/lib/services/shiftCash.core';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import { lockForUpdate } from '@/lib/api/race-guard';
import { staffDisplayName } from '@/lib/utils/staff-name';
import {
  emptyShiftSales,
  groupShiftSalesByShift,
} from '@/lib/shifts/shift-sales-count';
import { buildZReportTopItems } from '@/lib/shifts/z-report-top-items';

// ── Open Shift ───────────────────────────────────────────────────────────────

export async function openShift(tenantId: string, cashierId: string, openingFloat: number) {
  // XC-06 / M18 F10: the "is a shift already open?" check used to run OUTSIDE a
  // transaction, so three concurrent opens all passed the check and created
  // duplicates (the F10 race pin). Lock the cashier's row first so same-cashier
  // opens serialize: the loser sees the committed OPEN shift and 409s.
  const shift = await prisma.$transaction(async (tx) => {
    await lockForUpdate(tx, 'users', '"id" = $1', [cashierId]);

    const existing = await tx.shift.findFirst({
      where: {
        tenantId,
        cashierId,
        status: 'OPEN' satisfies ShiftStatus,
      },
    });

    if (existing) {
      throw new Error('CONFLICT: A shift is already open for this cashier');
    }

    return tx.shift.create({
      data: {
        tenantId,
        cashierId,
        openingFloat,
        status: 'OPEN' satisfies ShiftStatus,
      },
    });
    // 15s budget: concurrent opens queue on the row lock, so the losers
    // legitimately wait out the winner's commit (Prisma's 5s default P2028'd).
  }, { timeout: 15_000 });

  await createAuditLog({
    tenantId,
    actorId: cashierId,
    actorRole: 'CASHIER',
    entityType: 'Shift',
    entityId: shift.id,
    action: 'SHIFT_OPENED',
    after: { openingFloat },
  });

  return shift;
}

// ── Close Shift ──────────────────────────────────────────────────────────────

/**
 * Returns owned by a shift (ARGUS #109).
 *
 * Primary attribution is the shift that recorded the original sale, so an
 * overlapping shift can no longer claim the same refund by `createdAt`.
 * Legacy returns with a shiftless original sale fall back to the initiator's
 * covering shift (deterministic, single owner). The shared pure rule lives in
 * `shiftCash.core.ts` and is also used by the closure-recompute script.
 */
async function getShiftReturns(
  tenantId: string,
  shift: { id: string; cashierId: string; openedAt: Date },
  endAt: Date,
): Promise<ShiftRefundRow[]> {
  const [returns, cashierShifts] = await Promise.all([
    prisma.return.findMany({
      where: {
        tenantId,
        OR: [
          { originalSale: { shiftId: shift.id } },
          {
            originalSale: { shiftId: null },
            initiatedById: shift.cashierId,
            createdAt: { gte: shift.openedAt, lte: endAt },
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
    prisma.shift.findMany({
      where: { tenantId, cashierId: shift.cashierId },
      select: { id: true, cashierId: true, openedAt: true, closedAt: true },
    }),
  ]);

  const attributed = filterReturnsForShift(
    returns.map((ret) => ({
      refundAmount: ret.refundAmount,
      refundMethod: ret.refundMethod,
      originalSaleShiftId: ret.originalSale.shiftId,
      initiatedById: ret.initiatedById,
      createdAt: ret.createdAt,
    })),
    cashierShifts,
    shift.id,
  );

  return attributed.map((ret) => ({
    refundAmount: ret.refundAmount,
    refundMethod: ret.refundMethod,
  }));
}

export async function closeShift(
  tenantId: string,
  shiftId: string,
  actorId: string,
  input: { closingCashCount: number; notes?: string },
) {
  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, tenantId },
  });

  if (!shift) {
    throw new Error('Shift not found');
  }

  if (shift.status !== ('OPEN' satisfies ShiftStatus)) {
    throw new Error('Shift is not open');
  }

  // Authorization: only the shift's cashier or a MANAGER/OWNER can close it
  if (actorId !== shift.cashierId) {
    const actor = await prisma.user.findFirst({
      where: { id: actorId, tenantId },
      select: { role: true },
    });

    if (!actor || (actor.role !== 'MANAGER' && actor.role !== 'OWNER')) {
      throw new Error('FORBIDDEN: Only the shift cashier or a manager/owner can close this shift');
    }
  }

  // Void lingering OPEN sales
  await prisma.sale.updateMany({
    where: {
      shiftId,
      status: 'OPEN' satisfies SaleStatus,
    },
    data: {
      status: 'VOIDED' satisfies SaleStatus,
      voidedAt: new Date(),
      voidedById: actorId,
    },
  });

  // Aggregate COMPLETED sales. Tender totals come from the payment legs, not
  // `Sale.paymentMethod`: a sale may be settled by a mix of tenders (SPLIT) or
  // by store credit, and only the legs know how much money actually moved.
  const [salesAggregate, shiftPayments, salesCount] = await Promise.all([
    prisma.sale.aggregate({
      where: { shiftId, status: 'COMPLETED' satisfies SaleStatus },
      _sum: { totalAmount: true },
    }),
    prisma.payment.findMany({
      where: {
        sale: { shiftId, tenantId, status: 'COMPLETED' satisfies SaleStatus },
      },
      select: { method: true, amount: true },
    }),
    prisma.sale.count({
      where: { shiftId, status: 'COMPLETED' satisfies SaleStatus },
    }),
  ]);

  const paymentBreakdown = sumPaymentBreakdown(shiftPayments);

  const totalSalesAmount = new Decimal(salesAggregate._sum.totalAmount?.toString() ?? '0');
  const totalCashAmount = paymentBreakdown.cash;
  const totalCardAmount = paymentBreakdown.card;
  const totalQrAmount = paymentBreakdown.lankaqr;

  const now = new Date();

  // Aggregate the returns this shift owns. Attribution is by the shift that
  // recorded the original sale, not by the return's createdAt window: an
  // overlapping shift must never count the same refund (ARGUS #109).
  const shiftReturns = await getShiftReturns(tenantId, shift, now);

  const refunds = sumShiftRefunds(shiftReturns);
  const totalReturnsAmount = refunds.total;
  const cashRefundsTotal = refunds.cash;
  const totalReturnsCount = shiftReturns.length;

  // Aggregate cash movements (petty cash / manual deposits)
  const shiftCashMovements = await prisma.cashMovement.findMany({
    where: { shiftId, tenantId },
  });
  const { deposited: cmDeposited, pettyOut: cmPettyCashOut } =
    sumShiftCashMovements(shiftCashMovements);

  const expectedCash = computeExpectedCash({
    openingFloat: shift.openingFloat,
    cashSales: totalCashAmount,
    cashRefunds: cashRefundsTotal,
    cashDeposited: cmDeposited,
    pettyCashOut: cmPettyCashOut,
  });
  const closingCashCountDec = new Decimal(input.closingCashCount);
  const cashDifference = closingCashCountDec.minus(expectedCash);

  const result = await prisma.$transaction(async (tx) => {
    const closure = await tx.shiftClosure.create({
      data: {
        shiftId,
        closingCashCount: input.closingCashCount,
        expectedCash: expectedCash.toNumber(),
        cashDifference: cashDifference.toNumber(),
        totalSalesCount: salesCount,
        totalSalesAmount: totalSalesAmount.toNumber(),
        totalReturnsCount,
        totalReturnsAmount: totalReturnsAmount.toNumber(),
        totalCashAmount: totalCashAmount.toNumber(),
        totalCardAmount: totalCardAmount.toNumber(),
        totalQrAmount: totalQrAmount.toNumber(),
        closedById: actorId,
        closedAt: now,
      },
    });

    const updatedShift = await tx.shift.update({
      where: { id: shiftId },
      data: {
        status: 'CLOSED' satisfies ShiftStatus,
        closedAt: now,
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });

    return { shift: updatedShift, closure };
  });

  void createAuditLog({
    tenantId,
    actorId,
    actorRole: actorId === shift.cashierId ? 'CASHIER' : 'MANAGER',
    entityType: 'Shift',
    entityId: shiftId,
    action: AUDIT_ACTIONS.SHIFT_CLOSED,
    after: {
      closingCashCount: input.closingCashCount,
      expectedCash: expectedCash.toNumber(),
      cashDifference: cashDifference.toNumber(),
      totalSalesCount: salesCount,
      totalSalesAmount: totalSalesAmount.toNumber(),
    },
  }).catch(() => {});

  return result;
}

// ── Get Current Shift ────────────────────────────────────────────────────────

export async function getCurrentShift(tenantId: string, cashierId: string) {
  return prisma.shift.findFirst({
    where: {
      tenantId,
      cashierId,
      status: 'OPEN' satisfies ShiftStatus,
    },
  });
}

// ── Get Shift By ID ──────────────────────────────────────────────────────────

export async function getShiftById(
  tenantId: string,
  shiftId: string,
  viewerCashierId?: string | undefined,
) {
  const shift = await prisma.shift.findFirst({
    where: {
      id: shiftId,
      tenantId,
      ...(viewerCashierId ? { cashierId: viewerCashierId } : {}),
    },
    include: {
      cashier: { select: { id: true, email: true, role: true } },
      closure: true,
      _count: { select: { sales: true } },
    },
  });

  if (!shift) {
    throw new Error('Shift not found');
  }

  const [salesTotal, shiftPayments, shiftReturns, shiftCashMovements] = await Promise.all([
    prisma.sale.aggregate({
      where: {
        shiftId,
        status: 'COMPLETED' satisfies SaleStatus,
      },
      _sum: { totalAmount: true },
    }),
    prisma.payment.findMany({
      where: {
        sale: { shiftId, tenantId, status: 'COMPLETED' satisfies SaleStatus },
      },
      select: { method: true, amount: true },
    }),
    getShiftReturns(tenantId, shift, shift.closedAt ?? new Date()),
    prisma.cashMovement.findMany({
      where: { shiftId, tenantId },
      select: { amount: true, type: true },
    }),
  ]);

  const cashRefundsTotal = sumShiftRefunds(shiftReturns).cash;
  const { deposited: cashDeposited, pettyOut } = sumShiftCashMovements(shiftCashMovements);

  const openingFloat = new Decimal(shift.openingFloat.toString());
  const expectedCash = computeExpectedCash({
    openingFloat,
    cashSales: sumPaymentBreakdown(shiftPayments).cash,
    cashRefunds: cashRefundsTotal,
    cashDeposited,
    pettyCashOut: pettyOut,
  });

  return {
    ...shift,
    openingFloat: openingFloat.toNumber(),
    totalSalesAmount: new Decimal(salesTotal._sum.totalAmount?.toString() ?? '0').toNumber(),
    expectedCash: expectedCash.toDecimalPlaces(2).toNumber(),
  };
}

// ── Get Shifts (List) ────────────────────────────────────────────────────────

export interface GetShiftsFilters {
  cashierId?: string | undefined;
  status?: ShiftStatus | undefined;
  from?: Date | undefined;
  to?: Date | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

export async function getShifts(tenantId: string, filters?: GetShiftsFilters) {
  const page = Math.max(filters?.page ?? 1, 1);
  const limit = Math.min(Math.max(filters?.limit ?? 20, 1), 100);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { tenantId };

  if (filters?.cashierId) {
    where.cashierId = filters.cashierId;
  }
  if (filters?.status) {
    where.status = filters.status;
  }
  if (filters?.from || filters?.to) {
    const openedAt: Record<string, Date> = {};
    if (filters.from) openedAt.gte = filters.from;
    if (filters.to) openedAt.lte = filters.to;
    where.openedAt = openedAt;
  }

  const [shifts, total] = await Promise.all([
    prisma.shift.findMany({
      where,
      include: {
        cashier: { select: { id: true, email: true, role: true } },
        closure: true,
      },
      orderBy: { openedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.shift.count({ where }),
  ]);

  // ARGUS #110: `_count.sales` included OPEN (held) and VOIDED rows, so the list
  // labelled voided transactions as "Sales" and disagreed with the closure/
  // Z-report (COMPLETED only). Count by status for the page's shifts, keeping
  // the same tenant scope as the shift query.
  const shiftIds = shifts.map((shift) => shift.id);
  const groupedSales = shiftIds.length
    ? await prisma.sale.groupBy({
        by: ['shiftId', 'status'],
        where: { tenantId, shiftId: { in: shiftIds } },
        _count: { _all: true },
      })
    : [];
  const salesByShift = groupShiftSalesByShift(
    groupedSales.map((row) => ({
      shiftId: row.shiftId,
      status: row.status,
      count: row._count._all,
    })),
  );

  return {
    shifts: shifts.map((shift) => ({
      ...shift,
      salesCounts: salesByShift.get(shift.id) ?? emptyShiftSales(),
    })),
    total,
  };
}

// ── Z-Report Data ────────────────────────────────────────────────────────────

export interface ZReportData {
  shift: {
    id: string;
    openedAt: string;
    closedAt: string | null;
    status: string;
    cashierName: string;
    openingFloat: number;
    notes: string | null;
  };
  sales: {
    totalSalesCount: number;
    totalSalesAmount: number;
    cashSalesAmount: number;
    cardSalesAmount: number;
    lankaqrSalesAmount: number;
    voidedSalesCount: number;
    totalDiscountAmount: number;
  };
  returns: {
    totalReturnsCount: number;
    totalRefundAmount: number;
    cashRefundAmount: number;
    cardRefundAmount: number;
    creditRefundAmount: number;
    exchangeCount: number;
  };
  cashReconciliation: {
    openingFloat: number;
    cashSalesAmount: number;
    cashRefundAmount: number;
    cashDeposited: number;
    pettyCashOut: number;
    expectedCashInDrawer: number;
    actualCashCounted: number | null;
    cashDifference: number | null;
  };
  netRevenue: number;
  topProductsSold: Array<{
    productName: string;
    variantDescription: string;
    totalQtySold: number;
    totalRevenue: number;
  }>;
}

export async function buildZReportData(
  tenantId: string,
  shiftId: string,
  viewerCashierId?: string | undefined,
): Promise<ZReportData> {
  const shift = await prisma.shift.findFirst({
    where: {
      id: shiftId,
      tenantId,
      ...(viewerCashierId ? { cashierId: viewerCashierId } : {}),
    },
    include: {
      cashier: { select: { email: true } },
      closure: true,
    },
  });

  if (!shift) throw new Error('Shift not found');

  // Sales aggregation
  const completedSales = await prisma.sale.findMany({
    where: { shiftId, status: 'COMPLETED' satisfies SaleStatus },
    select: {
      status: true,
      totalAmount: true,
      discountAmount: true,
      payments: true,
      lines: {
        select: {
          productNameSnapshot: true,
          variantDescriptionSnapshot: true,
          quantity: true,
          lineTotalAfterDiscount: true,
        },
      },
    },
  });

  const voidedSalesCount = await prisma.sale.count({
    where: { shiftId, status: 'VOIDED' satisfies SaleStatus },
  });

  let totalSalesAmount = new Decimal(0);
  const paymentBreakdown = sumPaymentBreakdown(
    completedSales.flatMap((s) => s.payments),
  );
  let totalDiscountAmount = new Decimal(0);

  for (const sale of completedSales) {
    totalSalesAmount = totalSalesAmount.plus(new Decimal(sale.totalAmount.toString()));
    totalDiscountAmount = totalDiscountAmount.plus(new Decimal(sale.discountAmount.toString()));
  }

  const cashSalesAmount = paymentBreakdown.cash;
  const cardSalesAmount = paymentBreakdown.card;
  const lankaqrSalesAmount = paymentBreakdown.lankaqr;

  // Top products sold — collected revenue after the cart discount (ARGUS #112).
  // The old code summed lineTotalAfterDiscount (pre-cart-discount), so
  // promotions and zero-value bank sales inflated the report above the
  // completed-sales total.
  const topProductsSold = buildZReportTopItems(completedSales);

  // Returns aggregation — attributed to the shift that recorded the original
  // sale (ARGUS #109), never by overlapping createdAt windows.
  const returns = await getShiftReturns(tenantId, shift, shift.closedAt ?? new Date());

  let totalRefundAmount = new Decimal(0);
  let cashRefundAmount = new Decimal(0);
  let cardRefundAmount = new Decimal(0);
  let creditRefundAmount = new Decimal(0);
  let exchangeCount = 0;

  for (const ret of returns) {
    totalRefundAmount = totalRefundAmount.plus(new Decimal(ret.refundAmount.toString()));
    switch (ret.refundMethod) {
      case 'CASH' satisfies ReturnRefundMethod:
        cashRefundAmount = cashRefundAmount.plus(new Decimal(ret.refundAmount.toString()));
        break;
      case 'CARD_REVERSAL' satisfies ReturnRefundMethod:
        cardRefundAmount = cardRefundAmount.plus(new Decimal(ret.refundAmount.toString()));
        break;
      case 'STORE_CREDIT' satisfies ReturnRefundMethod:
        creditRefundAmount = creditRefundAmount.plus(new Decimal(ret.refundAmount.toString()));
        break;
      case 'EXCHANGE' satisfies ReturnRefundMethod:
        exchangeCount++;
        break;
    }
  }

  // Cash movements (petty cash / manual deposits)
  const cashMovements = await prisma.cashMovement.findMany({
    where: { shiftId, tenantId },
  });

  const { deposited: cashDeposited, pettyOut: pettyCashOutAmount } =
    sumShiftCashMovements(cashMovements);

  // Cash reconciliation
  // Expected = Opening Float + Cash Sales − Cash Refunds + Cash Deposited − Petty Cash Out
  const openingFloat = new Decimal(shift.openingFloat.toString());
  const expectedCashInDrawer = computeExpectedCash({
    openingFloat,
    cashSales: cashSalesAmount,
    cashRefunds: cashRefundAmount,
    cashDeposited,
    pettyCashOut: pettyCashOutAmount,
  });
  const actualCashCounted = shift.closure ? new Decimal(shift.closure.closingCashCount.toString()) : null;
  const cashDifference = actualCashCounted ? actualCashCounted.minus(expectedCashInDrawer) : null;

  const netRevenue = totalSalesAmount.minus(totalRefundAmount).toDecimalPlaces(2).toNumber();

  return {
    shift: {
      id: shift.id,
      openedAt: shift.openedAt.toISOString(),
      closedAt: shift.closedAt?.toISOString() ?? null,
      status: shift.status,
      cashierName: staffDisplayName(shift.cashier.email),
      openingFloat: openingFloat.toNumber(),
      notes: shift.notes,
    },
    sales: {
      totalSalesCount: completedSales.length,
      totalSalesAmount: totalSalesAmount.toDecimalPlaces(2).toNumber(),
      cashSalesAmount: cashSalesAmount.toDecimalPlaces(2).toNumber(),
      cardSalesAmount: cardSalesAmount.toDecimalPlaces(2).toNumber(),
      lankaqrSalesAmount: lankaqrSalesAmount.toDecimalPlaces(2).toNumber(),
      voidedSalesCount,
      totalDiscountAmount: totalDiscountAmount.toDecimalPlaces(2).toNumber(),
    },
    returns: {
      totalReturnsCount: returns.length,
      totalRefundAmount: totalRefundAmount.toDecimalPlaces(2).toNumber(),
      cashRefundAmount: cashRefundAmount.toDecimalPlaces(2).toNumber(),
      cardRefundAmount: cardRefundAmount.toDecimalPlaces(2).toNumber(),
      creditRefundAmount: creditRefundAmount.toDecimalPlaces(2).toNumber(),
      exchangeCount,
    },
    cashReconciliation: {
      openingFloat: openingFloat.toNumber(),
      cashSalesAmount: cashSalesAmount.toDecimalPlaces(2).toNumber(),
      cashRefundAmount: cashRefundAmount.toDecimalPlaces(2).toNumber(),
      cashDeposited: cashDeposited.toDecimalPlaces(2).toNumber(),
      pettyCashOut: pettyCashOutAmount.toDecimalPlaces(2).toNumber(),
      expectedCashInDrawer: expectedCashInDrawer.toDecimalPlaces(2).toNumber(),
      actualCashCounted: actualCashCounted?.toDecimalPlaces(2).toNumber() ?? null,
      cashDifference: cashDifference?.toDecimalPlaces(2).toNumber() ?? null,
    },
    netRevenue,
    topProductsSold,
  };
}
