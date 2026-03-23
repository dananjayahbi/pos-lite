import Decimal from 'decimal.js';
import { prisma } from '@/lib/prisma';
import type { ShiftStatus, SaleStatus, PaymentMethod, PaymentLegMethod, ReturnRefundMethod } from '@/generated/prisma/client';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';

// ── Open Shift ───────────────────────────────────────────────────────────────

export async function openShift(tenantId: string, cashierId: string, openingFloat: number) {
  const existing = await prisma.shift.findFirst({
    where: {
      tenantId,
      cashierId,
      status: 'OPEN' satisfies ShiftStatus,
    },
  });

  if (existing) {
    throw new Error('CONFLICT: A shift is already open for this cashier');
  }

  const shift = await prisma.shift.create({
    data: {
      tenantId,
      cashierId,
      openingFloat,
      status: 'OPEN' satisfies ShiftStatus,
    },
  });

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

  // Aggregate COMPLETED sales
  const [salesAggregate, cashAggregate, cardAggregate, salesCount] = await Promise.all([
    prisma.sale.aggregate({
      where: { shiftId, status: 'COMPLETED' satisfies SaleStatus },
      _sum: { totalAmount: true },
    }),
    prisma.sale.aggregate({
      where: {
        shiftId,
        status: 'COMPLETED' satisfies SaleStatus,
        paymentMethod: 'CASH' satisfies PaymentMethod,
      },
      _sum: { totalAmount: true },
    }),
    prisma.sale.aggregate({
      where: {
        shiftId,
        status: 'COMPLETED' satisfies SaleStatus,
        paymentMethod: 'CARD' satisfies PaymentMethod,
      },
      _sum: { totalAmount: true },
    }),
    prisma.sale.count({
      where: { shiftId, status: 'COMPLETED' satisfies SaleStatus },
    }),
  ]);

  // NOTE: SPLIT payments are NOT included in cash/card totals until SubPhase 03.02

  const totalSalesAmount = new Decimal(salesAggregate._sum.totalAmount?.toString() ?? '0');
  const totalCashAmount = new Decimal(cashAggregate._sum.totalAmount?.toString() ?? '0');
  const totalCardAmount = new Decimal(cardAggregate._sum.totalAmount?.toString() ?? '0');

  const now = new Date();

  // Aggregate returns during shift period
  const shiftReturns = await prisma.return.findMany({
    where: {
      tenantId,
      createdAt: { gte: shift.openedAt, lte: now },
    },
    select: { refundAmount: true, refundMethod: true },
  });

  let totalReturnsAmount = new Decimal(0);
  let cashRefundsTotal = new Decimal(0);
  for (const ret of shiftReturns) {
    totalReturnsAmount = totalReturnsAmount.plus(new Decimal(ret.refundAmount.toString()));
    if (ret.refundMethod === ('CASH' satisfies ReturnRefundMethod)) {
      cashRefundsTotal = cashRefundsTotal.plus(new Decimal(ret.refundAmount.toString()));
    }
  }
  const totalReturnsCount = shiftReturns.length;

  // Aggregate cash movements (petty cash / manual deposits)
  const shiftCashMovements = await prisma.cashMovement.findMany({
    where: { shiftId, tenantId },
  });

  let cmDeposited = new Decimal(0);
  let cmPettyCashOut = new Decimal(0);
  for (const cm of shiftCashMovements) {
    if (cm.type === 'MANUAL_IN') {
      cmDeposited = cmDeposited.plus(new Decimal(cm.amount.toString()));
    } else if (cm.type === 'PETTY_CASH_OUT' || cm.type === 'MANUAL_OUT') {
      cmPettyCashOut = cmPettyCashOut.plus(new Decimal(cm.amount.toString()));
    }
  }

  const openingFloatDec = new Decimal(shift.openingFloat.toString());
  const expectedCash = openingFloatDec
    .plus(totalCashAmount)
    .minus(cashRefundsTotal)
    .plus(cmDeposited)
    .minus(cmPettyCashOut);
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

export async function getShiftById(tenantId: string, shiftId: string) {
  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, tenantId },
    include: {
      cashier: { select: { id: true, email: true, role: true } },
      closure: true,
      _count: { select: { sales: true } },
    },
  });

  if (!shift) {
    throw new Error('Shift not found');
  }

  const [salesTotal, cashSalesTotal, shiftReturns, shiftCashMovements] = await Promise.all([
    prisma.sale.aggregate({
      where: {
        shiftId,
        status: 'COMPLETED' satisfies SaleStatus,
      },
      _sum: { totalAmount: true },
    }),
    prisma.sale.aggregate({
      where: {
        shiftId,
        status: 'COMPLETED' satisfies SaleStatus,
        paymentMethod: 'CASH' satisfies PaymentMethod,
      },
      _sum: { totalAmount: true },
    }),
    prisma.return.findMany({
      where: {
        tenantId,
        createdAt: {
          gte: shift.openedAt,
          lte: shift.closedAt ?? new Date(),
        },
      },
      select: { refundAmount: true, refundMethod: true },
    }),
    prisma.cashMovement.findMany({
      where: { shiftId, tenantId },
      select: { amount: true, type: true },
    }),
  ]);

  let cashRefundsTotal = new Decimal(0);
  for (const ret of shiftReturns) {
    if (ret.refundMethod === ('CASH' satisfies ReturnRefundMethod)) {
      cashRefundsTotal = cashRefundsTotal.plus(new Decimal(ret.refundAmount.toString()));
    }
  }

  let cashDeposited = new Decimal(0);
  let pettyCashOut = new Decimal(0);
  for (const movement of shiftCashMovements) {
    if (movement.type === 'MANUAL_IN') {
      cashDeposited = cashDeposited.plus(new Decimal(movement.amount.toString()));
    } else if (movement.type === 'PETTY_CASH_OUT' || movement.type === 'MANUAL_OUT') {
      pettyCashOut = pettyCashOut.plus(new Decimal(movement.amount.toString()));
    }
  }

  const openingFloat = new Decimal(shift.openingFloat.toString());
  const expectedCash = openingFloat
    .plus(new Decimal(cashSalesTotal._sum.totalAmount?.toString() ?? '0'))
    .minus(cashRefundsTotal)
    .plus(cashDeposited)
    .minus(pettyCashOut);

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
        _count: { select: { sales: true } },
      },
      orderBy: { openedAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.shift.count({ where }),
  ]);

  return { shifts, total };
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

export async function buildZReportData(tenantId: string, shiftId: string): Promise<ZReportData> {
  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, tenantId },
    include: {
      cashier: { select: { email: true } },
      closure: true,
    },
  });

  if (!shift) throw new Error('Shift not found');

  // Sales aggregation
  const completedSales = await prisma.sale.findMany({
    where: { shiftId, status: 'COMPLETED' satisfies SaleStatus },
    include: {
      payments: true,
      lines: true,
    },
  });

  const voidedSalesCount = await prisma.sale.count({
    where: { shiftId, status: 'VOIDED' satisfies SaleStatus },
  });

  let totalSalesAmount = new Decimal(0);
  let cashSalesAmount = new Decimal(0);
  let cardSalesAmount = new Decimal(0);
  let totalDiscountAmount = new Decimal(0);

  for (const sale of completedSales) {
    totalSalesAmount = totalSalesAmount.plus(new Decimal(sale.totalAmount.toString()));
    totalDiscountAmount = totalDiscountAmount.plus(new Decimal(sale.discountAmount.toString()));
    for (const payment of sale.payments) {
      if (payment.method === ('CASH' satisfies PaymentLegMethod)) {
        cashSalesAmount = cashSalesAmount.plus(new Decimal(payment.amount.toString()));
      } else {
        cardSalesAmount = cardSalesAmount.plus(new Decimal(payment.amount.toString()));
      }
    }
  }

  // Top products sold
  const productSalesMap = new Map<string, { productName: string; variantDescription: string; totalQtySold: number; totalRevenue: Decimal }>();
  for (const sale of completedSales) {
    for (const line of sale.lines) {
      const key = `${line.productNameSnapshot}|${line.variantDescriptionSnapshot}`;
      const existing = productSalesMap.get(key);
      if (existing) {
        existing.totalQtySold += line.quantity;
        existing.totalRevenue = existing.totalRevenue.plus(new Decimal(line.lineTotalAfterDiscount.toString()));
      } else {
        productSalesMap.set(key, {
          productName: line.productNameSnapshot,
          variantDescription: line.variantDescriptionSnapshot,
          totalQtySold: line.quantity,
          totalRevenue: new Decimal(line.lineTotalAfterDiscount.toString()),
        });
      }
    }
  }

  const topProductsSold = Array.from(productSalesMap.values())
    .sort((a, b) => b.totalQtySold - a.totalQtySold)
    .slice(0, 10)
    .map((p) => ({ ...p, totalRevenue: p.totalRevenue.toDecimalPlaces(2).toNumber() }));

  // Returns aggregation — by time range
  const shiftStart = shift.openedAt;
  const shiftEnd = shift.closedAt ?? new Date();

  const returns = await prisma.return.findMany({
    where: {
      tenantId,
      createdAt: { gte: shiftStart, lte: shiftEnd },
    },
  });

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

  let cashDeposited = new Decimal(0);
  let pettyCashOutAmount = new Decimal(0);
  for (const cm of cashMovements) {
    if (cm.type === 'MANUAL_IN') {
      cashDeposited = cashDeposited.plus(new Decimal(cm.amount.toString()));
    } else if (cm.type === 'PETTY_CASH_OUT' || cm.type === 'MANUAL_OUT') {
      pettyCashOutAmount = pettyCashOutAmount.plus(new Decimal(cm.amount.toString()));
    }
  }

  // Cash reconciliation
  // Expected = Opening Float + Cash Sales − Cash Refunds + Cash Deposited − Petty Cash Out
  const openingFloat = new Decimal(shift.openingFloat.toString());
  const expectedCashInDrawer = openingFloat
    .plus(cashSalesAmount)
    .minus(cashRefundAmount)
    .plus(cashDeposited)
    .minus(pettyCashOutAmount);
  const actualCashCounted = shift.closure ? new Decimal(shift.closure.closingCashCount.toString()) : null;
  const cashDifference = actualCashCounted ? actualCashCounted.minus(expectedCashInDrawer) : null;

  const netRevenue = totalSalesAmount.minus(totalRefundAmount).toDecimalPlaces(2).toNumber();

  return {
    shift: {
      id: shift.id,
      openedAt: shift.openedAt.toISOString(),
      closedAt: shift.closedAt?.toISOString() ?? null,
      status: shift.status,
      cashierName: shift.cashier.email,
      openingFloat: openingFloat.toNumber(),
      notes: shift.notes,
    },
    sales: {
      totalSalesCount: completedSales.length,
      totalSalesAmount: totalSalesAmount.toDecimalPlaces(2).toNumber(),
      cashSalesAmount: cashSalesAmount.toDecimalPlaces(2).toNumber(),
      cardSalesAmount: cardSalesAmount.toDecimalPlaces(2).toNumber(),
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
