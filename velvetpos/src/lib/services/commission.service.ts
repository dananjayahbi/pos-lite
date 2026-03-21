import { prisma } from '@/lib/prisma';
import Decimal from 'decimal.js';

export async function createCommissionRecord(input: {
  tenantId: string;
  saleId: string;
  userId: string;
  baseAmount: Decimal | string;
  commissionRate: Decimal | string;
}) {
  const base = new Decimal(input.baseAmount.toString());
  const rate = new Decimal(input.commissionRate.toString());

  if (rate.lt(0) || rate.gt(100)) {
    throw new Error('Commission rate must be between 0 and 100');
  }

  const earnedAmount = base.mul(rate).div(100);

  return prisma.commissionRecord.create({
    data: {
      tenantId: input.tenantId,
      saleId: input.saleId,
      userId: input.userId,
      baseAmount: base,
      commissionRate: rate,
      earnedAmount,
      isPaid: false,
    },
  });
}

export async function createNegativeCommissionRecord(returnId: string, tenantId: string) {
  const returnRecord = await prisma.return.findUnique({
    where: { id: returnId },
    select: {
      refundAmount: true,
      originalSaleId: true,
      originalSale: {
        select: { cashierId: true },
      },
    },
  });

  if (!returnRecord?.originalSale?.cashierId) return null;

  const user = await prisma.user.findUnique({
    where: { id: returnRecord.originalSale.cashierId },
    select: { commissionRate: true },
  });

  if (!user?.commissionRate) return null;

  const rate = new Decimal(user.commissionRate.toString());
  const refund = new Decimal(returnRecord.refundAmount.toString());
  const negativeEarned = refund.mul(rate).div(100).neg();

  return prisma.commissionRecord.create({
    data: {
      tenantId,
      saleId: returnRecord.originalSaleId,
      userId: returnRecord.originalSale.cashierId,
      baseAmount: refund.neg(),
      commissionRate: rate,
      earnedAmount: negativeEarned,
      isPaid: false,
    },
  });
}

export async function getCommissionsForUser(
  tenantId: string,
  userId: string,
  page: number,
  pageSize: number,
) {
  const [records, total] = await Promise.all([
    prisma.commissionRecord.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        sale: { select: { id: true, totalAmount: true, createdAt: true } },
        payout: { select: { id: true, paidAt: true } },
      },
    }),
    prisma.commissionRecord.count({ where: { tenantId, userId } }),
  ]);

  return { records, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getUnpaidTotal(tenantId: string, userId: string) {
  const result = await prisma.commissionRecord.aggregate({
    where: { tenantId, userId, isPaid: false },
    _sum: { earnedAmount: true },
  });
  return result._sum.earnedAmount ?? new Decimal(0);
}

export async function createCommissionPayout(input: {
  tenantId: string;
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  authorizedById: string;
  notes?: string | undefined;
}) {
  return prisma.$transaction(async (tx) => {
    const unpaidRecords = await tx.commissionRecord.findMany({
      where: {
        tenantId: input.tenantId,
        userId: input.userId,
        isPaid: false,
        createdAt: { gte: input.periodStart, lte: input.periodEnd },
      },
    });

    if (unpaidRecords.length === 0) {
      throw new Error('No unpaid commission records found for this period');
    }

    const totalEarned = unpaidRecords.reduce(
      (sum: Decimal, r: { earnedAmount: Decimal }) => sum.add(new Decimal(r.earnedAmount.toString())),
      new Decimal(0),
    );

    const payout = await tx.commissionPayout.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        totalEarned,
        authorizedById: input.authorizedById,
        ...(input.notes !== undefined && { notes: input.notes }),
      },
    });

    await tx.commissionRecord.updateMany({
      where: { id: { in: unpaidRecords.map((r: { id: string }) => r.id) } },
      data: { isPaid: true, payoutId: payout.id },
    });

    return payout;
  });
}

export async function getCommissionSummaryForTenant(
  tenantId: string,
  periodStart: Date,
  periodEnd: Date,
) {
  const users = await prisma.user.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, email: true, role: true },
  });

  const summaries = await Promise.all(
    users.map(async (user) => {
      const [earned, paid] = await Promise.all([
        prisma.commissionRecord.aggregate({
          where: {
            tenantId,
            userId: user.id,
            createdAt: { gte: periodStart, lte: periodEnd },
          },
          _sum: { earnedAmount: true },
        }),
        prisma.commissionRecord.aggregate({
          where: {
            tenantId,
            userId: user.id,
            isPaid: true,
            createdAt: { gte: periodStart, lte: periodEnd },
          },
          _sum: { earnedAmount: true },
        }),
      ]);

      const totalEarned = earned._sum.earnedAmount ?? new Decimal(0);
      const totalPaid = paid._sum.earnedAmount ?? new Decimal(0);
      const unpaid = new Decimal(totalEarned.toString()).sub(new Decimal(totalPaid.toString()));

      return {
        userId: user.id,
        email: user.email,
        role: user.role,
        totalEarned: totalEarned.toString(),
        totalPaid: totalPaid.toString(),
        unpaid: unpaid.toString(),
      };
    }),
  );

  return summaries.filter(
    (s) => s.totalEarned !== '0' || s.totalPaid !== '0',
  );
}
