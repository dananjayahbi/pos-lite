import { prisma } from '@/lib/prisma';
import Decimal from 'decimal.js';

export interface CashFlowResult {
  grossIncome: string;
  refunds: string;
  totalIncome: string;
  incomeByMethod: { method: string; total: string }[];
  expensesByCategory: { category: string; total: string }[];
  totalExpenses: string;
  cashMovements: { type: string; count: number; total: string }[];
  netMovement: string;
  netCashFlow: string;
}

export async function getCashFlowStatement(
  tenantId: string,
  dateFrom: Date,
  dateTo: Date,
): Promise<CashFlowResult> {
  const [salesResult, returnsResult, expensesByCategory, cashMovements, paymentsByMethod] =
    await Promise.all([
      prisma.sale.aggregate({
        where: { tenantId, status: 'COMPLETED', completedAt: { gte: dateFrom, lte: dateTo } },
        _sum: { totalAmount: true },
      }),
      prisma.return.aggregate({
        where: { tenantId, createdAt: { gte: dateFrom, lte: dateTo } },
        _sum: { refundAmount: true },
      }),
      prisma.expense.groupBy({
        by: ['category'],
        where: { tenantId, expenseDate: { gte: dateFrom, lte: dateTo } },
        _sum: { amount: true },
      }),
      prisma.cashMovement.groupBy({
        by: ['type'],
        where: { tenantId, createdAt: { gte: dateFrom, lte: dateTo } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payment.groupBy({
        by: ['method'],
        where: {
          sale: { tenantId, status: 'COMPLETED', completedAt: { gte: dateFrom, lte: dateTo } },
        },
        _sum: { amount: true },
      }),
    ]);

  const grossIncome = new Decimal(salesResult._sum.totalAmount?.toString() ?? '0');
  const refunds = new Decimal(returnsResult._sum.refundAmount?.toString() ?? '0');
  const totalIncome = grossIncome.minus(refunds);

  const incomeByMethod = paymentsByMethod.map((p) => ({
    method: p.method,
    total: new Decimal(p._sum.amount?.toString() ?? '0').toFixed(2),
  }));

  const expCategories = expensesByCategory.map((e) => ({
    category: e.category,
    total: new Decimal(e._sum.amount?.toString() ?? '0').toFixed(2),
  }));
  expCategories.sort((a, b) => parseFloat(b.total) - parseFloat(a.total));

  const totalExpenses = expCategories.reduce(
    (acc, e) => acc.plus(e.total),
    new Decimal(0),
  );

  const movements = cashMovements.map((m) => ({
    type: m.type,
    count: m._count,
    total: new Decimal(m._sum.amount?.toString() ?? '0').toFixed(2),
  }));

  const netMovement = movements.reduce((acc, m) => {
    if (m.type === 'MANUAL_IN' || m.type === 'OPENING_FLOAT') {
      return acc.plus(m.total);
    }
    return acc.minus(m.total);
  }, new Decimal(0));

  const netCashFlow = totalIncome.minus(totalExpenses);

  return {
    grossIncome: grossIncome.toFixed(2),
    refunds: refunds.toFixed(2),
    totalIncome: totalIncome.toFixed(2),
    incomeByMethod,
    expensesByCategory: expCategories,
    totalExpenses: totalExpenses.toFixed(2),
    cashMovements: movements,
    netMovement: netMovement.toFixed(2),
    netCashFlow: netCashFlow.toFixed(2),
  };
}
