import { prisma } from '@/lib/prisma';
import type { ExpenseCategory } from '@/generated/prisma/client';
import type { CreateExpenseInput, UpdateExpenseInput } from '@/lib/validators/expense.validators';
import { createAuditLog, AUDIT_ACTIONS } from '@/lib/services/audit.service';

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
  data: CreateExpenseInput & { recordedById: string },
) {
  const expense = await prisma.expense.create({
    data: {
      tenantId,
      category: data.category as ExpenseCategory,
      amount: data.amount,
      description: data.description,
      expenseDate: new Date(data.expenseDate),
      ...(data.receiptImageUrl !== undefined && { receiptImageUrl: data.receiptImageUrl }),
      recordedById: data.recordedById,
    },
    include: { recordedBy: { select: { email: true } } },
  });

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
  data: UpdateExpenseInput,
) {
  return prisma.expense.update({
    where: { id },
    data: {
      ...(data.category !== undefined && { category: data.category as ExpenseCategory }),
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.expenseDate !== undefined && { expenseDate: new Date(data.expenseDate) }),
      ...(data.receiptImageUrl !== undefined && { receiptImageUrl: data.receiptImageUrl }),
    },
    include: { recordedBy: { select: { email: true } } },
  });
}

export async function deleteExpense(tenantId: string, id: string, actorId: string) {
  const expense = await prisma.expense.findFirst({ where: { id, tenantId } });
  if (!expense) {
    throw new Error('Expense not found');
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
