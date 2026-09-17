import { prisma } from '@/lib/prisma';
import type { ExpenseCategory } from '@/generated/prisma/client';
import type { CreateExpenseInput, UpdateExpenseInput } from '@/lib/validators/expense.validators';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';
import { adjustFundBalance, assertFundCanSpend } from '@/lib/services/petty-cash.service';

interface ExpenseFilters {
  category?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
}

export async function getExpenses(tenantId: string, filters: ExpenseFilters) {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = { tenantId };

  if (filters.category) {
    where.category = filters.category as ExpenseCategory;
  }

  const dateFilter: Record<string, Date> = {};
  if (filters.dateFrom) {
    dateFilter.gte = new Date(filters.dateFrom);
  }
  if (filters.dateTo) {
    dateFilter.lte = new Date(filters.dateTo);
  }
  if (Object.keys(dateFilter).length > 0) {
    where.expenseDate = dateFilter;
  }

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      include: { recordedBy: { select: { email: true } } },
      orderBy: { expenseDate: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.expense.count({ where }),
  ]);

  return { expenses, total, page, pageSize };
}

export async function getExpenseById(tenantId: string, id: string) {
  return prisma.expense.findFirst({
    where: { id, tenantId },
    include: { recordedBy: { select: { email: true } } },
  });
}

export async function createExpense(
  tenantId: string,
  data: CreateExpenseInput & { recordedById: string; overdrawApproved?: boolean | undefined },
) {
  // M19-01 (BUG-53, D2): block a linked expense that would overdraw the fund
  // unless an explicit (permission-checked) manager approval rode along. Runs
  // BEFORE the row is created so a blocked overdraw writes nothing.
  if (data.pettyCashFundId) {
    await assertFundCanSpend(
      tenantId,
      data.pettyCashFundId,
      data.amount,
      data.overdrawApproved === true,
    );
  }

  const expense = await prisma.expense.create({
    data: {
      tenantId,
      category: data.category as ExpenseCategory,
      amount: data.amount,
      description: data.description,
      expenseDate: new Date(data.expenseDate),
      ...(data.receiptImageUrl !== undefined && { receiptImageUrl: data.receiptImageUrl }),
      ...(data.pettyCashFundId !== undefined && { pettyCashFundId: data.pettyCashFundId }),
      recordedById: data.recordedById,
    },
    include: { recordedBy: { select: { email: true } } },
  });

  // A linked petty-cash expense reduces the fund's running balance.
  if (data.pettyCashFundId) {
    await adjustFundBalance(tenantId, data.pettyCashFundId, -data.amount);
    // M19-01: an approved overdraft is a privileged exception — audit it with
    // the actor so the audit trail answers "who allowed the negative balance?".
    if (data.overdrawApproved === true) {
      void createAuditLog({
        tenantId,
        actorId: data.recordedById,
        actorRole: 'USER',
        entityType: 'PettyCashFund',
        entityId: data.pettyCashFundId,
        action: 'PETTY_CASH_OVERDRAW_APPROVED',
        after: { expenseId: expense.id, amount: expense.amount },
      }).catch(() => {});
    }
  }

  void createAuditLog({
    tenantId,
    actorId: data.recordedById,
    actorRole: 'USER',
    entityType: 'Expense',
    entityId: expense.id,
    action: AUDIT_ACTIONS.EXPENSE_CREATED,
    after: { category: expense.category, amount: expense.amount, description: expense.description },
  }).catch(() => {});

  return expense;
}

export async function updateExpense(
  tenantId: string,
  id: string,
  data: UpdateExpenseInput & { overdrawApproved?: boolean | undefined; actorId?: string | undefined },
) {
  const existing = await prisma.expense.findFirst({ where: { id, tenantId } });
  if (!existing) {
    throw new Error('Expense not found');
  }

  // M19-01 (D2): an edit that increases or re-links a fund-backed spend is
  // guarded exactly like a create. When the fund is unchanged the old amount is
  // credited back for the check (`credit`), because the net deduction is what
  // the fund must be able to absorb.
  const oldFundId = existing.pettyCashFundId;
  const oldAmount = existing.amount.toNumber();
  const newFundId = data.pettyCashFundId !== undefined ? data.pettyCashFundId : oldFundId;
  const newAmount = data.amount !== undefined ? data.amount : oldAmount;
  const sameFund = oldFundId !== null && newFundId === oldFundId;

  if (newFundId && (newFundId !== oldFundId || newAmount !== oldAmount)) {
    await assertFundCanSpend(
      tenantId,
      newFundId,
      newAmount,
      data.overdrawApproved === true,
      sameFund ? oldAmount : 0,
    );
    if (data.overdrawApproved === true) {
      void createAuditLog({
        tenantId,
        actorId: data.actorId ?? existing.recordedById,
        actorRole: 'USER',
        entityType: 'PettyCashFund',
        entityId: newFundId,
        action: 'PETTY_CASH_OVERDRAW_APPROVED',
        after: { expenseId: id, amount: newAmount },
      }).catch(() => {});
    }
  }

  const expense = await prisma.expense.update({
    where: { id },
    data: {
      ...(data.category !== undefined && { category: data.category as ExpenseCategory }),
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.expenseDate !== undefined && { expenseDate: new Date(data.expenseDate) }),
      ...(data.receiptImageUrl !== undefined && { receiptImageUrl: data.receiptImageUrl }),
      ...(data.pettyCashFundId !== undefined && { pettyCashFundId: data.pettyCashFundId }),
    },
    include: { recordedBy: { select: { email: true } } },
  });

  // Keep the fund balance in sync with a single net delta when the fund is
  // unchanged, or a refund+deduct pair when the expense moved between funds.
  if (oldFundId && newFundId && oldFundId === newFundId) {
    const delta = oldAmount - newAmount;
    if (delta !== 0) await adjustFundBalance(tenantId, oldFundId, delta);
  } else {
    if (oldFundId) await adjustFundBalance(tenantId, oldFundId, oldAmount);
    if (newFundId) await adjustFundBalance(tenantId, newFundId, -newAmount);
  }

  return expense;
}

export async function deleteExpense(tenantId: string, id: string, actorId: string) {
  const expense = await prisma.expense.findFirst({ where: { id, tenantId } });
  if (!expense) {
    throw new Error('Expense not found');
  }

  // Restore the fund balance when a linked petty-cash expense is removed.
  if (expense.pettyCashFundId) {
    await adjustFundBalance(tenantId, expense.pettyCashFundId, expense.amount.toNumber());
  }

  await prisma.expense.delete({ where: { id } });

  void createAuditLog({
    tenantId,
    actorId,
    actorRole: 'USER',
    entityType: 'Expense',
    entityId: id,
    action: AUDIT_ACTIONS.EXPENSE_DELETED,
    before: { category: expense.category, amount: expense.amount, description: expense.description },
  }).catch(() => {});
}
