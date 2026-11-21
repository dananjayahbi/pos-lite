'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, ArrowLeft, Lock, RefreshCw } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { formatRupee } from '@/lib/format';
import { resolveCashFlowReportState } from '@/lib/reports/cashflowReportState';
import type { CashFlowResult } from '@/lib/services/cashflow.service';

class CashFlowRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'CashFlowRequestError';
    this.status = status;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function getToday() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

const MOVEMENT_LABELS: Record<string, string> = {
  OPENING_FLOAT: 'Opening Float',
  PETTY_CASH_OUT: 'Petty Cash Out',
  MANUAL_IN: 'Manual In',
  MANUAL_OUT: 'Manual Out',
};

const MOVEMENT_COLORS: Record<string, string> = {
  OPENING_FLOAT: 'text-espresso',
  MANUAL_IN: 'text-green-700',
  PETTY_CASH_OUT: 'text-terracotta',
  MANUAL_OUT: 'text-terracotta',
};

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
};

const LEDGER_CATEGORY_LABELS: Record<string, string> = {
  SALE: 'Sales receipts',
  SALE_REFUND_RETURN: 'Return refunds',
  SALE_REFUND_VOID: 'Void reversals',
  SALE_REFUND_CANCELLATION: 'Cancelled-return reversals',
  SALE_REFUND_UNMATCHED: 'Unmatched sale refunds',
  SALE_REFUND: 'Sale refunds (unclassified)',
  OPENING_BALANCE: 'Opening balances',
  FUND_TRANSFER: 'Fund transfers',
  DEPOSIT: 'Deposits',
  WITHDRAWAL: 'Withdrawals',
  CLOSING_TRANSFER: 'Closing transfers',
  EXPENSE: 'Expenses',
  PURCHASE_ORDER_PAYMENT: 'Purchase-order payments',
  ADJUSTMENT: 'Adjustments',
};

const LEDGER_TREATMENT_LABELS: Record<string, string> = {
  sale: 'Income',
  return_refund: 'Refund',
  return_cancellation: 'Refund reversal',
  void_reversal: 'Void reversal',
  opening: 'Opening - excluded',
  transfer: 'Transfer - excluded',
  expense: 'Expense',
  purchase_order: 'Purchase',
  adjustment: 'Adjustment',
  unclassified: 'Unclassified',
};

function ledgerCategoryLabel(category: string) {
  return (
    LEDGER_CATEGORY_LABELS[category] ??
    category
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/^\w/, (char) => char.toUpperCase())
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CashFlowPage() {
  const [dateFrom, setDateFrom] = useState(getMonthStart());
  const [dateTo, setDateTo] = useState(getToday());
  const [queryDates, setQueryDates] = useState<{ from: string; to: string } | null>(null);
  const [runId, setRunId] = useState(0);
  const { hasPermission, isLoading: permissionLoading } = usePermissions();
  const canView = hasPermission(PERMISSIONS.REPORT.viewCashflowReport);

  const { data, isLoading, error, refetch } = useQuery<CashFlowResult>({
    queryKey: ['cash-flow', queryDates?.from, queryDates?.to, runId],
    queryFn: async () => {
      if (!queryDates) throw new Error('No dates');
      const res = await fetch(
        `/api/store/expenses/cash-flow?dateFrom=${queryDates.from}&dateTo=${queryDates.to}`,
      );
      let json: {
        success?: boolean;
        data?: CashFlowResult;
        error?: { message?: string };
      };
      try {
        json = await res.json();
      } catch {
        throw new CashFlowRequestError(
          `The report request failed (${res.status}).`,
          res.status,
        );
      }
      if (!res.ok || !json.success || !json.data) {
        throw new CashFlowRequestError(
          json.error?.message ?? `The report request failed (${res.status}).`,
          res.status,
        );
      }
      return json.data;
    },
    enabled: queryDates !== null && canView && !permissionLoading,
  });

  function handleGenerate() {
    setQueryDates({ from: dateFrom, to: dateTo });
    setRunId((current) => current + 1);
  }

  const hasActivity = Boolean(
    data &&
      (parseFloat(data.totalIncome) !== 0 ||
        parseFloat(data.totalExpenses) !== 0 ||
        data.cashMovements.length > 0 ||
        data.paymentAccountActivity.length > 0),
  );

  const reportState = resolveCashFlowReportState({
    canView,
    isPermissionLoading: permissionLoading,
    hasGenerated: queryDates !== null,
    isLoading,
    error: error
      ? {
          ...(error instanceof CashFlowRequestError ? { status: error.status } : {}),
          ...(error instanceof Error ? { message: error.message } : {}),
        }
      : null,
    hasActivity,
  });

  const netCashFlowNum = data ? parseFloat(data.netCashFlow) : 0;

  // Expense bar widths
  const maxExpense =
    data?.expensesByCategory.reduce(
      (max, e) => Math.max(max, parseFloat(e.total)),
      0,
    ) ?? 1;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/expenses">
          <Button variant="ghost" size="sm" className="text-espresso">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Expenses
          </Button>
        </Link>
        <h1 className="font-display text-2xl font-bold text-espresso">Cash Flow Statement</h1>
      </div>

      {/* Date Range + Generate */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label className="text-sm text-sand-ink">From</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-44 border-mist"
          />
        </div>
        <div>
          <Label className="text-sm text-sand-ink">To</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-44 border-mist"
          />
        </div>
        <Button
          onClick={handleGenerate}
          disabled={!reportState.canGenerate}
          className="bg-espresso text-pearl hover:bg-espresso/90"
        >
          Generate Report
        </Button>
      </div>

      {/* Checking session / permission */}
      {reportState.mode === 'permission-loading' && (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Access denied */}
      {reportState.mode === 'denied' && (
        <Card className="mx-auto w-full max-w-md border-mist text-center">
          <CardHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-sand/30">
              <Lock className="h-6 w-6 text-mist-ink" />
            </div>
            <CardTitle className="font-display text-xl text-espresso">Access Restricted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-body text-sm text-mist-ink">{reportState.message}</p>
            <Link
              href="/dashboard"
              className="mt-4 inline-block font-body text-sm text-espresso underline hover:text-terracotta"
            >
              Back to Dashboard
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {reportState.mode === 'loading' && (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* No query yet */}
      {reportState.mode === 'idle' && (
        <div className="py-16 text-center text-sand-ink">
          Select a date range and click &quot;Generate Report&quot; to view the cash flow statement.
        </div>
      )}

      {/* Request failed - report stays hidden */}
      {reportState.mode === 'error' && (
        <Card className="mx-auto w-full max-w-lg border-terracotta/30 bg-terracotta/10">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-terracotta" />
            <p className="mt-3 font-body text-sm text-terracotta">
              {reportState.message ?? 'Could not generate the cash flow report.'}
            </p>
            {reportState.canRetry && (
              <Button
                variant="outline"
                className="mt-4 border-terracotta/40 font-body text-espresso"
                onClick={() => {
                  void refetch();
                }}
              >
                <RefreshCw className="mr-1 h-4 w-4" />
                Try again
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {reportState.mode === 'empty' && (
        <div className="py-16 text-center text-sand-ink">
          No financial activity recorded for this period.
        </div>
      )}

      {/* Report */}
      {reportState.showReport && data && (
        <div className="space-y-6">
          {/* Metric Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-green-200 bg-green-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-normal text-green-700">Total Income</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-2xl font-bold text-green-800">
                  {formatRupee(data.totalIncome)}
                </p>
              </CardContent>
            </Card>

            <Card className="border-terracotta/30 bg-terracotta/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-normal text-terracotta">Total Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-2xl font-bold text-terracotta">
                  {formatRupee(data.totalExpenses)}
                </p>
              </CardContent>
            </Card>

            <Card
              className={
                netCashFlowNum >= 0
                  ? 'border-mist bg-linen'
                  : 'border-terracotta/30 bg-terracotta/10'
              }
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-normal text-espresso">
                  Net Cash Movement (ledger)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={`font-display text-[32px] font-bold ${
                    netCashFlowNum >= 0 ? 'text-green-800' : 'text-terracotta'
                  }`}
                >
                  {formatRupee(data.netCashFlow)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Cash reconciliation */}
          <Card className="border-mist">
            <CardHeader>
              <CardTitle className="font-display text-espresso">Cash Reconciliation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sand-ink">Opening cash</span>
                <span className="font-mono text-espresso">{formatRupee(data.openingCash)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sand-ink">Net movement in period</span>
                <span className="font-mono text-espresso">{formatRupee(data.netCashFlow)}</span>
              </div>
              <div className="my-2 border-t border-mist" />
              <div className="flex justify-between font-semibold">
                <span className="text-espresso">Closing cash</span>
                <span className="font-mono text-espresso">{formatRupee(data.closingCash)}</span>
              </div>
              {data.cashBridge.length > 0 && (
                <div className="mt-3 space-y-1 border-t border-mist pt-3">
                  <p className="text-xs uppercase tracking-wide text-mist-ink">
                    Movement by source
                  </p>
                  {data.cashBridge.map((line) => (
                    <div key={line.source} className="flex justify-between text-sm">
                      <span className="text-sand-ink">
                        {line.source.replaceAll('_', ' ').toLowerCase()}
                      </span>
                      <span className="font-mono text-espresso">{formatRupee(line.net)}</span>
                    </div>
                  ))}
                </div>
              )}
              {(data.shiftCash.openingFloat !== 0 ||
                data.shiftCash.operatingNet !== 0) && (
                <div className="mt-3 space-y-1 border-t border-mist pt-3">
                  <p className="text-xs uppercase tracking-wide text-mist-ink">
                    Shift cash not posted to payment accounts
                  </p>
                  <div className="flex justify-between text-sm">
                    <span className="text-sand-ink">Ledger net cash flow</span>
                    <span className="font-mono text-espresso">
                      {formatRupee(data.shiftCashBridge.ledgerNetCashFlow)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-sand-ink">
                      Shift operating movement (excludes opening float)
                    </span>
                    <span className="font-mono text-terracotta">
                      {formatRupee(data.shiftCashBridge.shiftOperatingNet)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-espresso">Net movement including shift cash</span>
                    <span className="font-mono text-espresso">
                      {formatRupee(data.shiftCashBridge.combinedNetCashFlow)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-mist-ink">
                    <span>Opening float (transfer, not income)</span>
                    <span className="font-mono">
                      {formatRupee(data.shiftCashBridge.shiftOpeningFloatTransfer)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ledger movement by population */}
          {data.ledgerBreakdown.length > 0 && (
            <Card className="border-mist">
              <CardHeader>
                <CardTitle className="font-display text-espresso">
                  Ledger Movement by Source
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-linen/40">
                      <TableHead className="text-espresso">Population</TableHead>
                      <TableHead className="text-espresso">Treatment</TableHead>
                      <TableHead className="text-right text-espresso">Debit</TableHead>
                      <TableHead className="text-right text-espresso">Credit</TableHead>
                      <TableHead className="text-right text-espresso">Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.ledgerBreakdown.map((line) => (
                      <TableRow key={line.category}>
                        <TableCell className="font-medium">
                          {ledgerCategoryLabel(line.category)}
                        </TableCell>
                        <TableCell className="text-xs text-sand-ink">
                          {LEDGER_TREATMENT_LABELS[line.treatment] ?? line.treatment}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatRupee(line.debit)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatRupee(line.credit)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono text-xs ${
                            line.net >= 0 ? 'text-green-700' : 'text-terracotta'
                          }`}
                        >
                          {formatRupee(line.net)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="mt-2 text-xs text-sand-ink">
                  Opening balances and internal transfers are shown as excluded populations. They
                  move account balances but are not trading income or expense, so they are not
                  folded into Money In / Money Out.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Ledger to income-statement bridge */}
          <Card className="border-mist">
            <CardHeader>
              <CardTitle className="font-display text-espresso">
                Ledger to Income Statement Bridge
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-sand-ink">Ledger sale debits</span>
                <span className="font-mono text-espresso">
                  {formatRupee(data.ledgerBridge.sales.ledger)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-sand-ink">Gross Sales (income statement)</span>
                <span className="font-mono text-espresso">
                  {formatRupee(data.ledgerBridge.sales.statement)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-sand-ink">Sales variance</span>
                <span className="font-mono text-terracotta">
                  {formatRupee(data.ledgerBridge.sales.variance)}
                </span>
              </div>
              <div className="my-2 border-t border-mist" />
              <div className="flex justify-between text-sm">
                <span className="text-sand-ink">Ledger return refunds</span>
                <span className="font-mono text-espresso">
                  {formatRupee(data.ledgerBridge.refunds.returnCredits)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-sand-ink">Less cancelled-return reversals</span>
                <span className="font-mono text-espresso">
                  {formatRupee(data.ledgerBridge.refunds.returnCancellations)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-sand-ink">Void reversals (not returns)</span>
                <span className="font-mono text-espresso">
                  {formatRupee(data.ledgerBridge.refunds.voidReversals)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-sand-ink">Returns (income statement)</span>
                <span className="font-mono text-espresso">
                  {formatRupee(data.ledgerBridge.refunds.statementReturns)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-sand-ink">Cash refunds in income statement</span>
                <span className="font-mono text-espresso">
                  {formatRupee(data.ledgerBridge.refunds.statementCashRefunds)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-sand-ink">Non-cash refunds (no ledger entry)</span>
                <span className="font-mono text-mist-ink">
                  {formatRupee(data.ledgerBridge.refunds.nonCashStatementRefunds)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-sand-ink">Refund variance</span>
                <span className="font-mono text-terracotta">
                  {formatRupee(data.ledgerBridge.refunds.variance)}
                </span>
              </div>
              <div className="my-2 border-t border-mist" />
              <div className="flex justify-between text-sm">
                <span className="text-sand-ink">Opening balances (excluded from income)</span>
                <span className="font-mono text-mist-ink">
                  {formatRupee(data.ledgerBridge.openingBalancesExcluded)}
                </span>
              </div>
              {data.ledgerBridge.exceptions.length > 0 && (
                <div className="mt-3 rounded-md border border-terracotta/30 bg-terracotta/10 px-3 py-2 text-xs text-terracotta">
                  <p className="font-semibold">Reconciliation exceptions</p>
                  {data.ledgerBridge.exceptions.map((exception) => (
                    <p key={exception.code}>
                      {exception.code === 'SALES_VARIANCE'
                        ? 'Ledger sale debits do not equal Gross Sales'
                        : 'Ledger return refunds do not equal cash refunds'}
                      : {formatRupee(exception.amount)}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Income Section */}
          <Card className="border-mist">
            <CardHeader>
              <CardTitle className="font-display text-espresso">Income</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sand-ink">Gross Sales</span>
                <span className="font-mono text-espresso">{formatRupee(data.grossIncome)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sand-ink">Cash refunds</span>
                <span className="font-mono text-terracotta">-{formatRupee(data.cashRefunds)}</span>
              </div>
              {parseFloat(data.nonCashRefunds) !== 0 && (
                <div className="flex justify-between text-mist-ink">
                  <span>Non-cash refunds (credit / exchange)</span>
                  <span className="font-mono">{formatRupee(data.nonCashRefunds)}</span>
                </div>
              )}
              <div className="my-2 border-t border-mist" />
              <div className="flex justify-between font-semibold">
                <span className="text-espresso">Net cash income</span>
                <span className="font-mono text-espresso">{formatRupee(data.totalIncome)}</span>
              </div>
              {(data.incomeByMethod.length > 0 ||
                data.paymentMethodReconciliation.status !== 'BALANCED') && (
                <div className="mt-3 space-y-1 border-t border-mist pt-3">
                  <p className="text-xs uppercase tracking-wide text-mist-ink">
                    Payment method allocation
                  </p>
                  {data.incomeByMethod.map((m) => (
                    <div key={m.method} className="flex justify-between text-sm">
                      <span className="text-sand-ink">{METHOD_LABELS[m.method] ?? m.method}</span>
                      <span className="font-mono text-espresso">{formatRupee(m.total)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm">
                    <span className="text-sand-ink">Unallocated / no payment record</span>
                    <span className="font-mono text-terracotta">
                      {formatRupee(data.paymentMethodReconciliation.unallocated)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-mist pt-1 text-sm font-semibold">
                    <span className="text-espresso">Method total + unallocated</span>
                    <span className="font-mono text-espresso">
                      {formatRupee(
                        data.paymentMethodReconciliation.allocated +
                          data.paymentMethodReconciliation.unallocated,
                      )}
                    </span>
                  </div>
                  {data.paymentMethodReconciliation.status !== 'BALANCED' && (
                    <div className="mt-2 rounded-md border border-terracotta/30 bg-terracotta/10 px-3 py-2 text-xs text-terracotta">
                      {data.paymentMethodReconciliation.status === 'UNALLOCATED'
                        ? `Payment methods are ${formatRupee(
                            data.paymentMethodReconciliation.unallocated,
                          )} short of Gross Sales. ${
                            data.missingPaymentSales.count
                          } completed sale(s) totalling ${formatRupee(
                            data.missingPaymentSales.total,
                          )} have no payment rows.`
                        : `Payment rows exceed Gross Sales by ${formatRupee(
                            Math.abs(data.paymentMethodReconciliation.unallocated),
                          )}.`}
                    </div>
                  )}
                </div>
              )}
              {data.refundsByMethod.length > 0 && (
                <p className="mt-1 text-sm text-sand-ink">
                  Refunds: {data.refundsByMethod
                    .map((m) => `${METHOD_LABELS[m.method] ?? m.method}: ${formatRupee(m.total)}`)
                    .join(' · ')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Expense Breakdown */}
          {data.expensesByCategory.length > 0 && (
            <Card className="border-mist">
              <CardHeader>
                <CardTitle className="font-display text-espresso">Expense Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-linen/40">
                      <TableHead className="text-espresso">Category</TableHead>
                      <TableHead className="text-right text-espresso">Total</TableHead>
                      <TableHead className="text-espresso" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.expensesByCategory.map((e) => {
                      const pct =
                        maxExpense > 0 ? (parseFloat(e.total) / maxExpense) * 100 : 0;
                      return (
                        <TableRow key={e.category}>
                          <TableCell>
                            {e.category.charAt(0) + e.category.slice(1).toLowerCase()}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatRupee(e.total)}
                          </TableCell>
                          <TableCell className="w-40">
                            <div className="h-3 w-full rounded bg-mist/30">
                              <div
                                className="h-3 rounded bg-sand"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-linen/40 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatRupee(data.totalExpenses)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Payment Account Activity */}
          {data.paymentAccountActivity.length > 0 && (
            <Card className="border-mist">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-display text-espresso">Payment Account Activity</CardTitle>
                <Link href="/payment-accounts" className="text-sm text-terracotta hover:underline">
                  Manage accounts
                </Link>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-linen/40">
                      <TableHead className="text-espresso">Account</TableHead>
                      <TableHead className="text-espresso">Type</TableHead>
                      <TableHead className="text-right text-espresso">Operating In</TableHead>
                      <TableHead className="text-right text-espresso">Operating Out</TableHead>
                      <TableHead className="text-right text-espresso">Transfers Net</TableHead>
                      <TableHead className="text-right text-espresso">Opening Balance</TableHead>
                      <TableHead className="text-right text-espresso">Period Movement</TableHead>
                      <TableHead className="text-right text-espresso">
                        Current Balance (all time)
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.paymentAccountActivity.map((account) => (
                      <TableRow key={account.accountId}>
                        <TableCell className="font-medium">{account.accountName}</TableCell>
                        <TableCell className="text-sand-ink">{account.accountType.replace(/_/g, ' ')}</TableCell>
                        <TableCell className="text-right font-mono text-green-700">
                          {formatRupee(account.operatingDebit)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-terracotta">
                          {formatRupee(account.operatingCredit)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sand-ink">
                          {formatRupee(account.transfersNet)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-mist-ink">
                          {formatRupee(account.openingBalance)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono ${
                            parseFloat(account.periodMovement) >= 0
                              ? 'text-green-700'
                              : 'text-terracotta'
                          }`}
                        >
                          {formatRupee(account.periodMovement)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatRupee(account.currentBalance)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-linen/40 font-semibold">
                      <TableCell colSpan={2}>Total</TableCell>
                      <TableCell className="text-right font-mono text-green-700">
                        {formatRupee(data.paymentAccountTotals.operatingDebit)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-terracotta">
                        {formatRupee(data.paymentAccountTotals.operatingCredit)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sand-ink">
                        {formatRupee(data.paymentAccountTotals.transfersNet)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-mist-ink">
                        {formatRupee(data.paymentAccountTotals.openingBalance)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatRupee(data.paymentAccountTotals.periodMovement)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatRupee(data.paymentAccountTotals.totalActiveBalance)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <p className="mt-2 text-xs text-sand-ink">
                  Operating In / Out exclude opening balances and internal transfers. Transfers Net
                  is the movement between accounts, and Opening Balance is a one-off capital entry
                  in the window - neither is income. Period Movement is the window movement, not
                  the all-time Current Balance.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Cash Movement Summary */}
          {data.cashMovements.length > 0 && (
            <Card className="border-mist">
              <CardHeader>
                <CardTitle className="font-display text-espresso">
                  Shift Cash Movements (not posted to payment accounts)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-xs text-sand-ink">
                  These entries belong to shifts and are not posted to the ledger. Opening float is
                  a transfer into the drawer - not income - so the operating impact below excludes
                  it and is reconciled in Cash Reconciliation above.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-linen/40">
                      <TableHead className="text-espresso">Type</TableHead>
                      <TableHead className="text-right text-espresso">Count</TableHead>
                      <TableHead className="text-right text-espresso">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.cashMovements.map((m) => (
                      <TableRow key={m.type}>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={MOVEMENT_COLORS[m.type] ?? 'text-espresso'}
                          >
                            {MOVEMENT_LABELS[m.type] ?? m.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">{m.count}</TableCell>
                        <TableCell
                          className={`text-right font-mono ${MOVEMENT_COLORS[m.type] ?? ''}`}
                        >
                          {formatRupee(m.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-linen/40 font-semibold">
                      <TableCell>Net Movement (as recorded)</TableCell>
                      <TableCell />
                      <TableCell
                        className={`text-right font-mono ${
                          parseFloat(data.netMovement) >= 0 ? 'text-green-700' : 'text-terracotta'
                        }`}
                      >
                        {formatRupee(data.netMovement)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="font-semibold">
                      <TableCell>Operating impact (excl. opening float)</TableCell>
                      <TableCell />
                      <TableCell
                        className={`text-right font-mono ${
                          data.shiftCash.operatingNet >= 0 ? 'text-green-700' : 'text-terracotta'
                        }`}
                      >
                        {formatRupee(data.shiftCash.operatingNet)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="text-xs text-mist-ink">
                      <TableCell>Opening float (transfer, excluded)</TableCell>
                      <TableCell />
                      <TableCell className="text-right font-mono">
                        {formatRupee(data.shiftCash.openingFloatTransfer)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
