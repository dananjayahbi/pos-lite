import { prisma } from '@/lib/prisma';
import Decimal from 'decimal.js';

export interface PaymentAccountActivityRow {
  accountId: string;
  accountName: string;
  accountType: string;
  status: string;
  debit: string;
  credit: string;
  net: string;
  currentBalance: string;
}

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
  /** Ledger activity per payment account for the same window. */
  paymentAccountActivity: PaymentAccountActivityRow[];
  paymentAccountTotals: {
    debit: string;
    credit: string;
    net: string;
    totalActiveBalance: string;
  };
}

export async function getCashFlowStatement(
  tenantId: string,
  dateFrom: Date,
  dateTo: Date,
): Promise<CashFlowResult> {
  const [
    salesResult,
    returnsResult,
    expensesByCategory,
    cashMovements,
    paymentsByMethod,
    accountEntryTotals,
    accounts,
  ] = await Promise.all([
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
    prisma.paymentAccountEntry.groupBy({
      by: ['accountId'],
      where: { tenantId, entryDate: { gte: dateFrom, lte: dateTo } },
      _sum: { debit: true, credit: true },
    }),
    prisma.paymentAccount.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        balance: true,
      },
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

  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const paymentAccountActivity: PaymentAccountActivityRow[] = accountEntryTotals
    .map((row) => {
      const account = accountMap.get(row.accountId);
      if (!account) return null;
      const debit = new Decimal(row._sum.debit?.toString() ?? '0');
      const credit = new Decimal(row._sum.credit?.toString() ?? '0');
      return {
        accountId: account.id,
        accountName: account.name,
        accountType: String(account.type),
        status: String(account.status),
        debit: debit.toFixed(2),
        credit: credit.toFixed(2),
        net: debit.minus(credit).toFixed(2),
        currentBalance: new Decimal(account.balance.toString()).toFixed(2),
      };
    })
    .filter((row): row is PaymentAccountActivityRow => row !== null)
    .sort((a, b) => Math.abs(parseFloat(b.net)) - Math.abs(parseFloat(a.net)));

  const accountDebit = paymentAccountActivity.reduce(
    (sum, row) => sum.plus(row.debit),
    new Decimal(0),
  );
  const accountCredit = paymentAccountActivity.reduce(
    (sum, row) => sum.plus(row.credit),
    new Decimal(0),
  );
  const totalActiveBalance = accounts
    .filter((account) => account.status === 'ACTIVE')
    .reduce((sum, account) => sum.plus(account.balance.toString()), new Decimal(0));

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
    paymentAccountActivity,
    paymentAccountTotals: {
      debit: accountDebit.toFixed(2),
      credit: accountCredit.toFixed(2),
      net: accountDebit.minus(accountCredit).toFixed(2),
      totalActiveBalance: totalActiveBalance.toFixed(2),
    },
  };
}
