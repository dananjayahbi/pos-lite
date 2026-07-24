import { prisma } from '@/lib/prisma';
import { AUDIT_ACTIONS, createAuditLog } from '@/lib/services/audit.service';
import Decimal from 'decimal.js';

type CommissionPayoutMetadata = {
  note?: string;
  paymentMethod?: string;
  proofReference?: string;
};

function serializePayoutNotes(metadata: CommissionPayoutMetadata): string | undefined {
  if (!metadata.note && !metadata.paymentMethod && !metadata.proofReference) {
    return undefined;
  }

  return JSON.stringify({
    ...(metadata.note ? { note: metadata.note } : {}),
    ...(metadata.paymentMethod ? { paymentMethod: metadata.paymentMethod } : {}),
    ...(metadata.proofReference ? { proofReference: metadata.proofReference } : {}),
  });
}

function buildPayoutMetadata(input: {
  note?: string | undefined;
  paymentMethod?: string | undefined;
  proofReference?: string | undefined;
}): CommissionPayoutMetadata {
  return {
    ...(input.note ? { note: input.note } : {}),
    ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
    ...(input.proofReference ? { proofReference: input.proofReference } : {}),
  };
}

export function parsePayoutNotes(notes: string | null | undefined): CommissionPayoutMetadata {
  if (!notes) {
    return {};
  }

  try {
    const parsed = JSON.parse(notes) as CommissionPayoutMetadata;
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
  } catch {
    return { note: notes };
  }

  return { note: notes };
}

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
  authorizedByRole: string;
  notes?: string | undefined;
  paymentMethod?: string | undefined;
  proofReference?: string | undefined;
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
    const serializedNotes = serializePayoutNotes(buildPayoutMetadata({
      note: input.notes,
      paymentMethod: input.paymentMethod,
      proofReference: input.proofReference,
    }));

    const payout = await tx.commissionPayout.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        totalEarned,
        authorizedById: input.authorizedById,
        ...(serializedNotes ? { notes: serializedNotes } : {}),
      },
      include: {
        user: { select: { email: true } },
        authorizedBy: { select: { email: true } },
      },
    });

    await tx.commissionRecord.updateMany({
      where: { id: { in: unpaidRecords.map((r: { id: string }) => r.id) } },
      data: { isPaid: true, payoutId: payout.id },
    });

    await createAuditLog({
      tenantId: input.tenantId,
      actorId: input.authorizedById,
      actorRole: input.authorizedByRole,
      entityType: 'CommissionPayout',
      entityId: payout.id,
      action: AUDIT_ACTIONS.COMMISSION_PAYOUT_CREATED,
      after: {
        payoutId: payout.id,
        userId: input.userId,
        periodStart: input.periodStart.toISOString(),
        periodEnd: input.periodEnd.toISOString(),
        totalEarned: totalEarned.toString(),
        paymentMethod: input.paymentMethod ?? null,
        proofReference: input.proofReference ?? null,
      },
    });

    return payout;
  });
}

export async function getCommissionPayouts(
  tenantId: string,
  filters: {
    userId?: string | undefined;
    periodStart?: Date | undefined;
    periodEnd?: Date | undefined;
    page?: number | undefined;
    pageSize?: number | undefined;
  } = {},
) {
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.min(Math.max(filters.pageSize ?? 20, 1), 100);
  const where = {
    tenantId,
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...((filters.periodStart || filters.periodEnd)
      ? {
          paidAt: {
            ...(filters.periodStart ? { gte: filters.periodStart } : {}),
            ...(filters.periodEnd ? { lte: filters.periodEnd } : {}),
          },
        }
      : {}),
  };

  const [records, total] = await Promise.all([
    prisma.commissionPayout.findMany({
      where,
      include: {
        user: { select: { email: true, role: true } },
        authorizedBy: { select: { email: true } },
      },
      orderBy: { paidAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.commissionPayout.count({ where }),
  ]);

  return {
    records: records.map((record) => {
      const metadata = parsePayoutNotes(record.notes);
      return {
        id: record.id,
        userId: record.userId,
        userEmail: record.user.email,
        userRole: record.user.role,
        totalEarned: record.totalEarned.toString(),
        periodStart: record.periodStart,
        periodEnd: record.periodEnd,
        paidAt: record.paidAt,
        authorizedByEmail: record.authorizedBy.email,
        note: metadata.note ?? null,
        paymentMethod: metadata.paymentMethod ?? null,
        proofReference: metadata.proofReference ?? null,
      };
    }),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
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
