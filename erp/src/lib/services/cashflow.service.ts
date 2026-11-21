import { prisma } from '@/lib/prisma';
import Decimal from 'decimal.js';
import {
  buildIncomeStatementBridge,
  classifySaleRefundEntries,
  reconcileCash,
  reconcilePaymentMethods,
  splitCashRefunds,
  summarizeAccountLedger,
  type IncomeStatementBridge,
  type LedgerBreakdownLine,
  type PaymentMethodReconciliation,
  type SaleRefundLedgerEntry,
} from '@/lib/services/cashflow.core';

export interface PaymentAccountActivityRow {
  accountId: string;
  accountName: string;
  accountType: string;
  status: string;
  /** Full ledger period debit, including opening balances and transfers. */
  debit: string;
  /** Full ledger period credit, including opening balances and transfers. */
  credit: string;
  /** Full ledger period movement (debit - credit). */
  net: string;
  /** Period debit excluding opening balances and internal transfers. */
  operatingDebit: string;
  /** Period credit excluding opening balances and internal transfers. */
  operatingCredit: string;
  /** Net movement of transfers inside / between accounts. */
  transfersNet: string;
  /** Opening-balance entries in the window (one-off capital, not income). */
  openingBalance: string;
  /** Ledger period movement; explicitly not the all-time account balance. */
  periodMovement: string;
  returnRefundCredits: string;
  voidReversalCredits: string;
  currentBalance: string;
}

export interface CashFlowResult {
  grossIncome: string;
  refunds: string;
  /** Refunds that actually left cash/bank (CASH, CARD_REVERSAL). */
  cashRefunds: string;
  /** STORE_CREDIT / EXCHANGE refunds - no cash impact (ARGUS #417). */
  nonCashRefunds: string;
  refundsByMethod: { method: string; total: string }[];
  totalIncome: string;
  incomeByMethod: { method: string; total: string }[];
  /** Payment-method totals reconciled to Gross Sales (ARGUS #419). */
  paymentMethodReconciliation: PaymentMethodReconciliation;
  /** Completed, non-zero sales in the window that have no Payment rows. */
  missingPaymentSales: { count: number; total: string };
  expensesByCategory: { category: string; total: string }[];
  totalExpenses: string;
  cashMovements: { type: string; count: number; total: string }[];
  netMovement: string;
  /** Ledger-truth opening cash at dateFrom. */
  openingCash: string;
  /** Ledger-truth closing cash at dateTo (opening + net ledger movement). */
  closingCash: string;
  /** closingCash - openingCash. */
  netCashFlow: string;
  /** Net movement per ledger source in the window (debit - credit). */
  cashBridge: { source: string; debit: string; credit: string; net: string }[];
  /**
   * The same ledger window grouped by population: sales, return refunds, void
   * reversals, opening balances, transfers, expenses, PO payments. This is what
   * explains why ledger totals differ from the income statement (ARGUS #418).
   */
  ledgerBreakdown: LedgerBreakdownLine[];
  /** Explicit variances between ledger sales/refunds and the income statement. */
  ledgerBridge: IncomeStatementBridge;
  /** Ledger activity per payment account for the same window. */
  paymentAccountActivity: PaymentAccountActivityRow[];
  paymentAccountTotals: {
    /** Full period debit (includes opening balances and transfers). */
    debit: string;
    /** Full period credit (includes opening balances and transfers). */
    credit: string;
    /** Full period movement, not an all-time balance. */
    net: string;
    operatingDebit: string;
    operatingCredit: string;
    transfersNet: string;
    openingBalance: string;
    periodMovement: string;
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
    missingPaymentSales,
    accountLedgerBySource,
    openingLedger,
    ledgerBySource,
    saleRefundEntries,
    accounts,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: { tenantId, status: 'COMPLETED', completedAt: { gte: dateFrom, lte: dateTo } },
      _sum: { totalAmount: true },
    }),
    prisma.return.groupBy({
      by: ['refundMethod'],
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
    prisma.sale.aggregate({
      where: {
        tenantId,
        status: 'COMPLETED',
        completedAt: { gte: dateFrom, lte: dateTo },
        totalAmount: { gt: 0 },
        payments: { none: {} },
      },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.paymentAccountEntry.groupBy({
      by: ['accountId', 'source'],
      where: { tenantId, entryDate: { gte: dateFrom, lte: dateTo } },
      _sum: { debit: true, credit: true },
    }),
    prisma.paymentAccountEntry.aggregate({
      where: { tenantId, entryDate: { lt: dateFrom } },
      _sum: { debit: true, credit: true },
    }),
    prisma.paymentAccountEntry.groupBy({
      by: ['source'],
      where: { tenantId, entryDate: { gte: dateFrom, lte: dateTo } },
      _sum: { debit: true, credit: true },
    }),
    prisma.paymentAccountEntry.findMany({
      where: {
        tenantId,
        source: 'SALE_REFUND',
        entryDate: { gte: dateFrom, lte: dateTo },
      },
      select: { accountId: true, sourceId: true, debit: true, credit: true },
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

  // SALE_REFUND rows carry the originating document id. Resolve the ids that
  // are returns vs sales so void reversals can be separated from return
  // refunds (ARGUS #418). Both are bounded by the refund rows in the window.
  const refundSourceIds = Array.from(
    new Set(
      saleRefundEntries
        .map((entry) => entry.sourceId)
        .filter((sourceId): sourceId is string => Boolean(sourceId)),
    ),
  );
  const [refundReturnRows, refundSaleRows] =
    refundSourceIds.length > 0
      ? await Promise.all([
          prisma.return.findMany({
            where: { tenantId, id: { in: refundSourceIds } },
            select: { id: true },
          }),
          prisma.sale.findMany({
            where: { tenantId, id: { in: refundSourceIds } },
            select: { id: true },
          }),
        ])
      : [[], []];
  const returnIds = new Set(refundReturnRows.map((row) => row.id));
  const saleIds = new Set(refundSaleRows.map((row) => row.id));
  const allRefundSplit = classifySaleRefundEntries(saleRefundEntries, {
    returnIds,
    saleIds,
  });

  const ledgerSummary = summarizeAccountLedger(
    ledgerBySource.map((row) => ({
      source: String(row.source),
      debit: row._sum.debit?.toString() ?? '0',
      credit: row._sum.credit?.toString() ?? '0',
    })),
    allRefundSplit,
  );

  const grossIncome = new Decimal(salesResult._sum.totalAmount?.toString() ?? '0');
  const split = splitCashRefunds(
    returnsResult.map((row) => ({
      method: String(row.refundMethod),
      total: row._sum.refundAmount?.toString() ?? '0',
    })),
  );
  const refundsByMethod = split.byMethod;
  const refunds = new Decimal(split.total);
  const cashRefunds = new Decimal(split.cash);
  const nonCashRefunds = new Decimal(split.nonCash);
  const totalIncome = grossIncome.minus(cashRefunds);

  const ledgerBridge = buildIncomeStatementBridge({
    ledgerSales: ledgerSummary.salesNet,
    statementGrossSales: grossIncome.toFixed(2),
    ledgerReturnRefundCredits: ledgerSummary.returnRefundCredits,
    ledgerReturnCancellationDebits: ledgerSummary.returnCancellationDebits,
    ledgerVoidReversalCredits: ledgerSummary.voidReversalCredits,
    statementReturns: refunds.toFixed(2),
    statementCashRefunds: cashRefunds.toFixed(2),
    openingBalancesExcluded: ledgerSummary.openingBalance,
  });

  const incomeByMethod = paymentsByMethod.map((p) => ({
    method: p.method,
    total: new Decimal(p._sum.amount?.toString() ?? '0').toFixed(2),
  }));
  const paymentMethodReconciliation = reconcilePaymentMethods(
    grossIncome.toFixed(2),
    incomeByMethod,
  );

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

  // Cash-flow reconciliation from the payment-account ledger: opening balance
  // before the window plus every debit/credit in it = closing balance. The
  // sales-minus-expenses figure is a period operating summary, not cash
  // (purchase orders, transfers and petty cash were missing from it) - keep it
  // available but do not label it net cash flow (ARGUS #416).
  const openingCashDecimal = new Decimal(openingLedger._sum.debit?.toString() ?? '0').minus(
    openingLedger._sum.credit?.toString() ?? '0',
  );
  const reconciliation = reconcileCash(
    openingCashDecimal,
    ledgerBySource.map((row) => ({
      source: String(row.source),
      debit: row._sum.debit?.toString() ?? '0',
      credit: row._sum.credit?.toString() ?? '0',
    })),
  );
  const netCashFlow = new Decimal(reconciliation.netMovement);
  const closingCash = new Decimal(reconciliation.closingCash);
  const cashBridge = reconciliation.bridge;

  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const accountSources = new Map<string, Array<{ source: string; debit: string; credit: string }>>();
  for (const row of accountLedgerBySource) {
    const list = accountSources.get(row.accountId) ?? [];
    list.push({
      source: String(row.source),
      debit: row._sum.debit?.toString() ?? '0',
      credit: row._sum.credit?.toString() ?? '0',
    });
    accountSources.set(row.accountId, list);
  }

  const accountRefunds = new Map<string, SaleRefundLedgerEntry[]>();
  for (const entry of saleRefundEntries) {
    const list = accountRefunds.get(entry.accountId) ?? [];
    list.push({
      sourceId: entry.sourceId,
      debit: entry.debit.toString(),
      credit: entry.credit.toString(),
    });
    accountRefunds.set(entry.accountId, list);
  }

  const paymentAccountActivity: PaymentAccountActivityRow[] = Array.from(
    accountSources.entries(),
  )
    .map(([accountId, sources]) => {
      const account = accountMap.get(accountId);
      if (!account) return null;
      const refundEntries = accountRefunds.get(accountId) ?? [];
      const summary = summarizeAccountLedger(
        sources,
        refundEntries.length > 0
          ? classifySaleRefundEntries(refundEntries, { returnIds, saleIds })
          : undefined,
      );
      return {
        accountId: account.id,
        accountName: account.name,
        accountType: String(account.type),
        status: String(account.status),
        debit: summary.periodDebit.toFixed(2),
        credit: summary.periodCredit.toFixed(2),
        net: summary.periodMovement.toFixed(2),
        operatingDebit: summary.operatingDebit.toFixed(2),
        operatingCredit: summary.operatingCredit.toFixed(2),
        transfersNet: summary.transfersNet.toFixed(2),
        openingBalance: summary.openingBalance.toFixed(2),
        periodMovement: summary.periodMovement.toFixed(2),
        returnRefundCredits: summary.returnRefundCredits.toFixed(2),
        voidReversalCredits: summary.voidReversalCredits.toFixed(2),
        currentBalance: new Decimal(account.balance.toString()).toFixed(2),
      };
    })
    .filter((row): row is PaymentAccountActivityRow => row !== null)
    .sort(
      (a, b) =>
        Math.abs(parseFloat(b.periodMovement)) - Math.abs(parseFloat(a.periodMovement)),
    );

  const totalActiveBalance = accounts
    .filter((account) => account.status === 'ACTIVE')
    .reduce((sum, account) => sum.plus(account.balance.toString()), new Decimal(0));
  const sumRow = (
    field:
      | 'debit'
      | 'credit'
      | 'periodMovement'
      | 'operatingDebit'
      | 'operatingCredit'
      | 'transfersNet'
      | 'openingBalance',
  ) => paymentAccountActivity.reduce((sum, row) => sum.plus(row[field]), new Decimal(0));

  return {
    grossIncome: grossIncome.toFixed(2),
    refunds: refunds.toFixed(2),
    cashRefunds: cashRefunds.toFixed(2),
    nonCashRefunds: nonCashRefunds.toFixed(2),
    refundsByMethod,
    totalIncome: totalIncome.toFixed(2),
    incomeByMethod,
    paymentMethodReconciliation,
    missingPaymentSales: {
      count: missingPaymentSales._count._all,
      total: new Decimal(missingPaymentSales._sum.totalAmount?.toString() ?? '0').toFixed(2),
    },
    expensesByCategory: expCategories,
    totalExpenses: totalExpenses.toFixed(2),
    cashMovements: movements,
    netMovement: netMovement.toFixed(2),
    openingCash: openingCashDecimal.toFixed(2),
    closingCash: closingCash.toFixed(2),
    netCashFlow: netCashFlow.toFixed(2),
    cashBridge,
    ledgerBreakdown: ledgerSummary.breakdown,
    ledgerBridge,
    paymentAccountActivity,
    paymentAccountTotals: {
      debit: sumRow('debit').toFixed(2),
      credit: sumRow('credit').toFixed(2),
      net: sumRow('periodMovement').toFixed(2),
      operatingDebit: sumRow('operatingDebit').toFixed(2),
      operatingCredit: sumRow('operatingCredit').toFixed(2),
      transfersNet: sumRow('transfersNet').toFixed(2),
      openingBalance: sumRow('openingBalance').toFixed(2),
      periodMovement: sumRow('periodMovement').toFixed(2),
      totalActiveBalance: totalActiveBalance.toFixed(2),
    },
  };
}
