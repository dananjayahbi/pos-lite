import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api/errors';
import { AUDIT_ACTIONS, createAuditLog } from '@/lib/services/audit.service';
import { lockForUpdate } from '@/lib/api/race-guard';
import { assertSufficientFunds, postLedgerEntries } from '@/lib/services/paymentAccount.service';
import { adjustFundBalance, assertFundCanSpend } from '@/lib/services/petty-cash.service';
import {
  allocateCommissionPayment,
  summarizeCommissionAllocation,
  summarizeOpenCommission,
} from '@/lib/services/commission-allocation';
import { describeCommissionBalance } from '@/lib/services/commissionSummary.core';
import {
  planCommissionReversal,
  resolveCommissionSaleDate,
  resolveOriginalCommissionBase,
  resolveOriginalCommissionRate,
} from '@/lib/services/commissionClawback.core';
import type { TxClient } from '@/lib/services/inventory.service';
import {
  PAYROLL_PENDING_ACCOUNT_PREFIX,
  planPayrollCommission,
} from '@/lib/services/payrollCommission.core';
import { PaymentEntrySource, ReturnStatus } from '@/generated/prisma/client';
import {
  COMMISSION_RATE_BOUND_MESSAGE,
  COMMISSION_RATE_MAX,
  COMMISSION_RATE_MIN,
} from '@/lib/constants/commission-rate';
import Decimal from 'decimal.js';

type CommissionPayoutMetadata = {
  note?: string;
  paymentMethod?: string;
  proofReference?: string;
  /** ARGUS #366: per-payout net allocation summary for the receipt. */
  allocation?: {
    recordCount: number;
    grossAllocated: string;
    adjustmentsSettled: string;
    netAllocated: string;
  };
};

function serializePayoutNotes(metadata: CommissionPayoutMetadata): string | undefined {
  if (
    !metadata.note &&
    !metadata.paymentMethod &&
    !metadata.proofReference &&
    !metadata.allocation
  ) {
    return undefined;
  }

  return JSON.stringify({
    ...(metadata.note ? { note: metadata.note } : {}),
    ...(metadata.paymentMethod ? { paymentMethod: metadata.paymentMethod } : {}),
    ...(metadata.proofReference ? { proofReference: metadata.proofReference } : {}),
    ...(metadata.allocation ? { allocation: metadata.allocation } : {}),
  });
}

function buildPayoutMetadata(input: {
  note?: string | undefined;
  paymentMethod?: string | undefined;
  proofReference?: string | undefined;
  allocation?:
    | {
        recordCount: number;
        grossAllocated: string;
        adjustmentsSettled: string;
        netAllocated: string;
      }
    | undefined;
}): CommissionPayoutMetadata {
  return {
    ...(input.note ? { note: input.note } : {}),
    ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
    ...(input.proofReference ? { proofReference: input.proofReference } : {}),
    ...(input.allocation ? { allocation: input.allocation } : {}),
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

  // ARGUS #342: the same 0-100 contract as the staff API validator and form.
  if (rate.lt(COMMISSION_RATE_MIN) || rate.gt(COMMISSION_RATE_MAX)) {
    throw new ApiError(400, 'VALIDATION_ERROR', COMMISSION_RATE_BOUND_MESSAGE);
  }

  const earnedAmount = base.mul(rate).div(100);

  // `createdAt` is the entry timestamp. Period reports deliberately use the
  // sale's accounting date (`Sale.saleDate`, falling back to `Sale.createdAt`)
  // so a backdated sale still reports in its sale month (ARGUS #365).
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

export interface ReconcileCommissionForSaleInput {
  tenantId: string;
  saleId: string;
  /** True when the sale was voided: the whole commission is reversed. */
  voided?: boolean | undefined;
  /** Actor for the audit row (void actor, return initiator, or SYSTEM). */
  actorId?: string | null | undefined;
  /** Optional transaction so the clawback commits with the void/return. */
  tx?: TxClient | undefined;
}

/**
 * Reconcile commission for one sale to its post-return/void target (ARGUS #361).
 *
 * The original positive records are never mutated — a partially or fully paid
 * payout stays truthful. A new negative `CommissionRecord` (paidAmount 0,
 * isPaid false) is written for the shortfall, so the next payout nets it via
 * the #337 paidAmount/payout model. Re-running is idempotent because the plan
 * compares the target base with the signed base already on the ledger.
 *
 * Returns the adjustment row, or null when there is no commission, no shortfall
 * (already reconciled), or the sale has no positive commission basis.
 */
export async function reconcileCommissionForSale(input: ReconcileCommissionForSaleInput) {
  const client = input.tx ?? prisma;

  const records = await client.commissionRecord.findMany({
    where: { tenantId: input.tenantId, saleId: input.saleId },
    orderBy: { createdAt: 'asc' },
  });
  if (records.length === 0) return null;

  const positive = records.filter(
    (record) => new Decimal(record.baseAmount.toString()).gt(0),
  );
  if (positive.length === 0) return null;

  const originalBase = resolveOriginalCommissionBase(records);
  const originalEarned = positive.reduce(
    (sum, record) => sum.plus(record.earnedAmount.toString()),
    new Decimal(0),
  );
  if (originalBase.lte(0) || originalEarned.lte(0)) return null;

  // ARGUS #345: reverse with the rate that actually earned the commission, not
  // the staff member's current rate. A single row carries the exact snapshot;
  // mixed/legacy rows fall back to the earned/base weighted average.
  const originalRate = resolveOriginalCommissionRate(records);

  const [refunded, sale] = await Promise.all([
    client.return.aggregate({
      where: {
        tenantId: input.tenantId,
        originalSaleId: input.saleId,
        status: ReturnStatus.COMPLETED,
      },
      _sum: { refundAmount: true },
    }),
    client.sale.findUnique({
      where: { id: input.saleId },
      select: { totalAmount: true, createdAt: true, completedAt: true },
    }),
  ]);

  const existingBase = records.reduce(
    (sum, record) => sum.plus(record.baseAmount.toString()),
    new Decimal(0),
  );

  // Both sides use the tax-inclusive sale base: `refundAmount` includes the tax
  // that was refunded (Return.refundAmount / Return.taxAmount), so a full
  // return claws the full commission rather than leaving the VAT share behind.
  const saleBase = sale
    ? new Decimal(sale.totalAmount.toString())
    : originalBase;

  const plan = planCommissionReversal({
    originalBase,
    commissionRate: originalRate,
    saleBase,
    returnedBase: refunded._sum.refundAmount?.toString() ?? '0',
    voided: input.voided === true,
    existingBase,
  });

  if (plan.noop) return null;

  const saleDate = sale ? resolveCommissionSaleDate(sale) : new Date();

  const adjustment = await client.commissionRecord.create({
    data: {
      tenantId: input.tenantId,
      saleId: input.saleId,
      userId: positive[0]!.userId,
      baseAmount: plan.adjustmentBase,
      commissionRate: originalRate,
      earnedAmount: plan.adjustmentEarned,
      isPaid: false,
      // Payroll period truth: the reversing row belongs to the sale's period.
      createdAt: saleDate,
    },
  });

  void createAuditLog({
    tenantId: input.tenantId,
    actorId: input.actorId ?? null,
    actorRole: input.actorId ? 'UNKNOWN' : 'SYSTEM',
    entityType: 'CommissionRecord',
    entityId: adjustment.id,
    action: 'COMMISSION_CLAWED_BACK',
    after: {
      saleId: input.saleId,
      voided: input.voided === true,
      saleDate: saleDate.toISOString(),
      commissionRate: originalRate.toFixed(2),
      saleBase: saleBase.toFixed(2),
      originalBase: originalBase.toFixed(2),
      returnedBase: refunded._sum.refundAmount?.toString() ?? '0',
      targetBase: plan.targetBase.toFixed(2),
      adjustmentBase: plan.adjustmentBase.toFixed(2),
      adjustmentEarned: plan.adjustmentEarned.toFixed(2),
      outstanding: true,
    },
  }).catch(() => {});

  return adjustment;
}

export async function getCommissionsForUser(
  tenantId: string,
  userId: string,
  page: number,
  pageSize: number,
) {
  const where = { tenantId, userId };
  const [records, total, earnedAgg, paidAgg, lastPayout] = await Promise.all([
    prisma.commissionRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        sale: { select: { id: true, totalAmount: true, createdAt: true } },
        payout: { select: { id: true, paidAt: true } },
      },
    }),
    prisma.commissionRecord.count({ where }),
    prisma.commissionRecord.aggregate({ where, _sum: { earnedAmount: true } }),
    prisma.commissionRecord.aggregate({ where, _sum: { paidAmount: true } }),
    prisma.commissionPayout.findFirst({
      where,
      orderBy: { paidAt: 'desc' },
      select: { id: true, paidAt: true, totalEarned: true },
    }),
  ]);

  // ARGUS #337: the badges describe the FULL ledger, not the current page.
  // Only `paidAmount` counts as paid; `isPaid` alone is not money.
  const summary = describeCommissionBalance({
    totalEarned: earnedAgg._sum.earnedAmount,
    totalPaid: paidAgg._sum.paidAmount,
  });

  return {
    records,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    summary: { ...summary, lastPayout },
  };
}

export async function getUnpaidTotal(tenantId: string, userId: string) {
  const where = { tenantId, userId };
  const [earned, paid] = await Promise.all([
    prisma.commissionRecord.aggregate({ where, _sum: { earnedAmount: true } }),
    prisma.commissionRecord.aggregate({ where, _sum: { paidAmount: true } }),
  ]);

  const { unpaid } = describeCommissionBalance({
    totalEarned: earned._sum.earnedAmount,
    totalPaid: paid._sum.paidAmount,
  });
  return new Decimal(unpaid);
}

/** Commission totals for one staff member over a date range (payslip). */
export async function getCommissionSummaryForUser(
  tenantId: string,
  userId: string,
  _periodStart: Date,
  periodEnd: Date,
) {
  // ARGUS #374: payroll pays the current outstanding balance up to month-end,
  // not just records created in that month, so earlier negative clawbacks and
  // partial payouts carry forward. Records reserved by a pending payroll run
  // are already committed to that run and are excluded here.
  const records = await prisma.commissionRecord.findMany({
    where: {
      tenantId,
      userId,
      // ARGUS #365: pay outstanding commission whose sale accounting date is
      // up to month-end; a backdated sale belongs to its sale month.
      sale: {
        status: { not: 'VOIDED' },
        OR: [
          { saleDate: { lte: periodEnd } },
          { saleDate: null, createdAt: { lte: periodEnd } },
        ],
      },
      OR: [
        { payoutId: null },
        { payout: { paymentAccountName: null } },
        {
          payout: {
            paymentAccountName: {
              not: { startsWith: PAYROLL_PENDING_ACCOUNT_PREFIX },
            },
          },
        },
      ],
    },
    select: { id: true, earnedAmount: true, paidAmount: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const plan = planPayrollCommission(records);
  const earned = records.reduce(
    (sum, record) => sum.plus(record.earnedAmount.toString()),
    new Decimal(0),
  );
  const paid = records.reduce(
    (sum, record) => sum.plus(record.paidAmount.toString()),
    new Decimal(0),
  );

  return {
    earned: describeCommissionBalance({ totalEarned: earned, totalPaid: paid }).totalEarned,
    paid: describeCommissionBalance({ totalEarned: earned, totalPaid: paid }).totalPaid,
    unpaid: plan.payable.toFixed(2),
  };
}

export interface CreateCommissionPayoutInput {
  tenantId: string;
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  authorizedById: string;
  authorizedByRole: string;
  notes?: string | undefined;
  /** Legacy free-text method; new payouts derive this from the account name. */
  paymentMethod?: string | undefined;
  proofReference?: string | undefined;
  /** Payment account the money leaves. Required for new payouts. */
  paymentAccountId?: string | undefined;
  /** Amount to pay now. Omit to settle the full outstanding balance. */
  amount?: Decimal.Value | undefined;
}

export async function createCommissionPayout(input: CreateCommissionPayoutInput) {
  if (!input.paymentAccountId) {
    throw new ApiError(422, 'VALIDATION_ERROR', 'Select a payment account for this payout');
  }
  const paymentAccountId = input.paymentAccountId;

  const transactionResult = await prisma.$transaction(async (tx) => {
    // M20-02 (XC-06): serialize concurrent double-submits for the same staff
    // member by locking the user row first — the loser re-reads the settled
    // balance and cannot pay the same commission twice.
    await lockForUpdate(tx, 'users', '"id" = $1', [input.userId]);

    const staff = await tx.user.findFirst({
      where: { id: input.userId, tenantId: input.tenantId },
      select: { email: true, fullName: true },
    });
    if (!staff) throw ApiError.notFound('Staff member not found');

    // ARGUS #337: openness is determined by money, not the derived `isPaid`
    // flag — legacy rows carry `isPaid = true` with `paidAmount = 0` and are
    // still payable. `summarizeOpenCommission` drops fully settled records.
    const unpaidRecords = await tx.commissionRecord.findMany({
      where: {
        tenantId: input.tenantId,
        userId: input.userId,
        // ARGUS #365: period reporting follows the sale's accounting date, not
        // when the commission row happened to be inserted (backdated sales).
        sale: {
          OR: [
            { saleDate: { gte: input.periodStart, lte: input.periodEnd } },
            {
              saleDate: null,
              createdAt: { gte: input.periodStart, lte: input.periodEnd },
            },
          ],
        },
        OR: [
          { payoutId: null },
          { payout: { paymentAccountName: null } },
          {
            payout: {
              paymentAccountName: {
                not: { startsWith: PAYROLL_PENDING_ACCOUNT_PREFIX },
              },
            },
          },
        ],
      },
      select: { id: true, earnedAmount: true, paidAmount: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const { netOutstanding, records: openRecords } = summarizeOpenCommission(unpaidRecords);

    if (netOutstanding.lte(0)) {
      throw new Error('No unpaid commission records found for this period');
    }

    const requested =
      input.amount === undefined ? netOutstanding : new Decimal(input.amount.toString());
    if (requested.lte(0)) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Payout amount must be greater than zero');
    }
    if (requested.gt(netOutstanding.plus(0.005))) {
      throw new ApiError(
        422,
        'VALIDATION_ERROR',
        `Payout amount cannot exceed the unpaid balance of ${netOutstanding
          .toDecimalPlaces(2)
          .toString()}`,
      );
    }

    const amount = requested.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    // ARGUS #366: allocate before writing the payout so the receipt can store
    // the gross/adjustment/net reconciliation derived from the same math.
    const allocations = allocateCommissionPayment(openRecords, amount);
    const allocationSummary = summarizeCommissionAllocation(openRecords, allocations);

    const account = await tx.paymentAccount.findFirst({
      where: { id: paymentAccountId, tenantId: input.tenantId },
      include: { pettyCashFund: { select: { id: true } } },
    });
    if (!account) throw ApiError.notFound('Payment account not found');
    if (account.status !== 'ACTIVE') {
      throw ApiError.conflict(`Account "${account.name}" is closed and cannot pay commissions`);
    }

    await assertSufficientFunds(tx, input.tenantId, account.id, amount);
    const pettyCashFundId = account.pettyCashFund?.id ?? null;
    if (pettyCashFundId) {
      await assertFundCanSpend(input.tenantId, pettyCashFundId, amount.toNumber(), false);
    }

    const staffName = staff.fullName?.trim() || staff.email.split('@')[0] || staff.email;
    const serializedNotes = serializePayoutNotes(
      buildPayoutMetadata({
        note: input.notes,
        paymentMethod: account.name,
        proofReference: input.proofReference,
        allocation: allocationSummary,
      }),
    );

    const payout = await tx.commissionPayout.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        totalEarned: amount,
        authorizedById: input.authorizedById,
        paymentAccountId: account.id,
        paymentAccountName: account.name,
        ...(serializedNotes ? { notes: serializedNotes } : {}),
      },
    });

    // Commission is salary expense: the same transaction writes the expense
    // ledger row and the account debit so cash flow and accounts reconcile.
    const expense = await tx.expense.create({
      data: {
        tenantId: input.tenantId,
        category: 'STAFF_COMMISSIONS',
        amount,
        description: `Staff commission payout - ${staffName} (${input.periodStart
          .toISOString()
          .slice(0, 10)} to ${input.periodEnd.toISOString().slice(0, 10)})`,
        paymentAccountId: account.id,
        recordedById: input.authorizedById,
        expenseDate: new Date(),
      },
    });

    await tx.commissionPayout.update({
      where: { id: payout.id },
      data: { expenseId: expense.id },
    });

    await postLedgerEntries(
      tx,
      input.tenantId,
      input.authorizedById,
      [
        {
          accountId: account.id,
          source: PaymentEntrySource.EXPENSE,
          sourceId: expense.id,
          description: `Staff commissions - ${staffName}`.slice(0, 200),
          credit: amount,
        },
      ],
      { allowPettyCashAccount: true },
    );

    for (const allocation of allocations) {
      await tx.commissionRecord.update({
        where: { id: allocation.id },
        data: {
          paidAmount: allocation.newPaid,
          isPaid: allocation.isPaid,
          payoutId: payout.id,
        },
      });
    }

    return { payout, pettyCashFundId, amount, accountName: account.name, staffName, expenseId: expense.id, allocation: allocationSummary };
  });

  // A linked petty-cash payout also reduces the fund's running balance. Kept
  // outside the transaction because adjustFundBalance owns its own write and
  // low-balance check.
  if (transactionResult.pettyCashFundId) {
    await adjustFundBalance(
      input.tenantId,
      transactionResult.pettyCashFundId,
      -transactionResult.amount.toNumber(),
    );
  }

  await createAuditLog({
    tenantId: input.tenantId,
    actorId: input.authorizedById,
    actorRole: input.authorizedByRole,
    entityType: 'CommissionPayout',
    entityId: transactionResult.payout.id,
    action: AUDIT_ACTIONS.COMMISSION_PAYOUT_CREATED,
    after: {
      payoutId: transactionResult.payout.id,
      userId: input.userId,
      periodStart: input.periodStart.toISOString(),
      periodEnd: input.periodEnd.toISOString(),
      amountPaid: transactionResult.amount.toString(),
      paymentAccount: transactionResult.accountName,
      expenseId: transactionResult.expenseId,
      proofReference: input.proofReference ?? null,
      allocation: {
        recordCount: transactionResult.allocation.recordCount,
        grossAllocated: transactionResult.allocation.grossAllocated,
        adjustmentsSettled: transactionResult.allocation.adjustmentsSettled,
        netAllocated: transactionResult.allocation.netAllocated,
      },
    },
  });

  return transactionResult.payout;
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
  // ARGUS #362: a payout is shown in the selected *commission* window, not by
  // the date the money happened to leave. A September commission paid in
  // November therefore stays in the September report.
  const periodConditions: Array<Record<string, unknown>> = [];
  if (filters.periodStart) {
    periodConditions.push({ periodEnd: { gte: filters.periodStart } });
  }
  if (filters.periodEnd) {
    periodConditions.push({ periodStart: { lte: filters.periodEnd } });
  }
  const where = {
    tenantId,
    ...(filters.userId ? { userId: filters.userId } : {}),
    AND: [
      ...periodConditions,
      // Pending payroll reservations are not payouts yet; hide them until the
      // run is marked paid (ARGUS #372).
      {
        OR: [
          { paymentAccountName: null },
          { paymentAccountName: { not: { startsWith: PAYROLL_PENDING_ACCOUNT_PREFIX } } },
        ],
      },
    ],
  };

  const [records, total] = await Promise.all([
    prisma.commissionPayout.findMany({
      where,
      include: {
        user: { select: { email: true, fullName: true, role: true } },
        authorizedBy: { select: { email: true, fullName: true } },
        paymentAccount: { select: { id: true, name: true } },
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
        userName: record.user.fullName?.trim() || null,
        userRole: record.user.role,
        totalEarned: record.totalEarned.toString(),
        periodStart: record.periodStart,
        periodEnd: record.periodEnd,
        paidAt: record.paidAt,
        authorizedByEmail: record.authorizedBy.email,
        authorizedByName: record.authorizedBy.fullName?.trim() || null,
        note: metadata.note ?? null,
        paymentMethod: metadata.paymentMethod ?? null,
        allocation: metadata.allocation ?? null,
        paymentAccountId: record.paymentAccountId,
        paymentAccountName: record.paymentAccountName ?? record.paymentAccount?.name ?? null,
        expenseId: record.expenseId,
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
    select: { id: true, email: true, fullName: true, role: true },
  });

  const summaries = await Promise.all(
    users.map(async (user) => {
      const where = {
        tenantId,
        userId: user.id,
        // ARGUS #365: report commission in the period of the sale's accounting
        // date. Backdated sales keep their date; pre-saleDate rows fall back
        // to createdAt.
        sale: {
          OR: [
            { saleDate: { gte: periodStart, lte: periodEnd } },
            { saleDate: null, createdAt: { gte: periodStart, lte: periodEnd } },
          ],
        },
      };
      const [earned, paid] = await Promise.all([
        prisma.commissionRecord.aggregate({ where, _sum: { earnedAmount: true } }),
        prisma.commissionRecord.aggregate({ where, _sum: { paidAmount: true } }),
      ]);

      // ARGUS #337: Total Paid is recorded payout money; an `isPaid` flag with
      // paidAmount 0 (legacy) must not reduce the open liability.
      const balance = describeCommissionBalance({
        totalEarned: earned._sum.earnedAmount,
        totalPaid: paid._sum.paidAmount,
      });

      return {
        userId: user.id,
        email: user.email,
        fullName: user.fullName?.trim() || null,
        role: user.role,
        totalEarned: balance.totalEarned,
        totalPaid: balance.totalPaid,
        unpaid: balance.unpaid,
      };
    }),
  );

  return summaries.filter(
    (s) => s.totalEarned !== '0.00' || s.totalPaid !== '0.00',
  );
}
