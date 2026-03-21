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
import { ArrowLeft } from 'lucide-react';
import { formatRupee } from '@/lib/format';
import type { CashFlowResult } from '@/lib/services/cashflow.service';

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

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CashFlowPage() {
  const [dateFrom, setDateFrom] = useState(getMonthStart());
  const [dateTo, setDateTo] = useState(getToday());
  const [queryDates, setQueryDates] = useState<{ from: string; to: string } | null>(null);

  const { data, isLoading } = useQuery<CashFlowResult>({
    queryKey: ['cash-flow', queryDates?.from, queryDates?.to],
    queryFn: async () => {
      if (!queryDates) throw new Error('No dates');
      const res = await fetch(
        `/api/store/expenses/cash-flow?dateFrom=${queryDates.from}&dateTo=${queryDates.to}`,
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to fetch');
      return json.data;
    },
    enabled: queryDates !== null,
  });

  function handleGenerate() {
    setQueryDates({ from: dateFrom, to: dateTo });
  }

  const hasActivity =
    data &&
    (parseFloat(data.totalIncome) !== 0 ||
      parseFloat(data.totalExpenses) !== 0 ||
      data.cashMovements.length > 0);

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
          <Label className="text-sm text-sand">From</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-44 border-mist"
          />
        </div>
        <div>
          <Label className="text-sm text-sand">To</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-44 border-mist"
          />
        </div>
        <Button onClick={handleGenerate} className="bg-espresso text-pearl hover:bg-espresso/90">
          Generate Report
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* No query yet */}
      {!queryDates && !isLoading && (
        <div className="py-16 text-center text-sand">
          Select a date range and click &quot;Generate Report&quot; to view the cash flow statement.
        </div>
      )}

      {/* Empty state */}
      {queryDates && !isLoading && data && !hasActivity && (
        <div className="py-16 text-center text-sand">
          No financial activity recorded for this period.
        </div>
      )}

      {/* Report */}
      {data && hasActivity && (
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
                <CardTitle className="text-sm font-normal text-espresso">Net Cash Flow</CardTitle>
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

          {/* Income Section */}
          <Card className="border-mist">
            <CardHeader>
              <CardTitle className="font-display text-espresso">Income</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sand">Gross Sales</span>
                <span className="font-mono text-espresso">{formatRupee(data.grossIncome)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sand">Refunds</span>
                <span className="font-mono text-terracotta">-{formatRupee(data.refunds)}</span>
              </div>
              <div className="my-2 border-t border-mist" />
              <div className="flex justify-between font-semibold">
                <span className="text-espresso">Net Income</span>
                <span className="font-mono text-espresso">{formatRupee(data.totalIncome)}</span>
              </div>
              {data.incomeByMethod.length > 0 && (
                <p className="mt-2 text-sm text-sand">
                  {data.incomeByMethod
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

          {/* Cash Movement Summary */}
          {data.cashMovements.length > 0 && (
            <Card className="border-mist">
              <CardHeader>
                <CardTitle className="font-display text-espresso">Cash Movement Summary</CardTitle>
              </CardHeader>
              <CardContent>
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
                      <TableCell>Net Movement</TableCell>
                      <TableCell />
                      <TableCell
                        className={`text-right font-mono ${
                          parseFloat(data.netMovement) >= 0 ? 'text-green-700' : 'text-terracotta'
                        }`}
                      >
                        {formatRupee(data.netMovement)}
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
