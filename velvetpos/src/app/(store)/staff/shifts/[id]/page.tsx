'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import PettyCashSection from '@/components/shift/PettyCashSection';
import { formatRupee } from '@/lib/format';
import type { ZReportData } from '@/lib/services/shift.service';

interface ShiftDetail {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt: string | null;
  openingFloat: number;
  expectedCash: number;
  totalSalesAmount: number;
  cashier: { id: string; email: string; role: string };
  closure: {
    closingCashCount: number;
    cashDifference: number;
    closedAt: string;
  } | null;
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-LK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function formatDuration(openedAt: string, closedAt: string | null) {
  const start = new Date(openedAt).getTime();
  const end = closedAt ? new Date(closedAt).getTime() : Date.now();
  const diffMs = end - start;
  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

export default function ShiftDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const shiftQuery = useQuery<{ success: boolean; data: ShiftDetail }>({
    queryKey: ['shift-detail', id],
    queryFn: async () => {
      const res = await fetch(`/api/store/shifts/${id}`);
      if (!res.ok) throw new Error('Failed to fetch shift detail');
      return res.json();
    },
  });

  const reportQuery = useQuery<{ success: boolean; data: ZReportData }>({
    queryKey: ['shift-detail-report', id],
    queryFn: async () => {
      const res = await fetch(`/api/store/shifts/${id}/z-report`);
      if (!res.ok) throw new Error('Failed to fetch shift report');
      return res.json();
    },
  });

  if (shiftQuery.isLoading || reportQuery.isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (shiftQuery.error || reportQuery.error || !shiftQuery.data?.data || !reportQuery.data?.data) {
    return (
      <div className="space-y-4 p-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/staff/shifts">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to shifts
          </Link>
        </Button>
        <Card className="border-mist">
          <CardContent className="py-12 text-center text-sand">
            {(shiftQuery.error as Error | undefined)?.message ?? (reportQuery.error as Error | undefined)?.message ?? 'Failed to load shift detail'}
          </CardContent>
        </Card>
      </div>
    );
  }

  const shift = shiftQuery.data.data;
  const report = reportQuery.data.data;
  const isOpen = shift.status === 'OPEN';

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/staff/shifts">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to shifts
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-espresso">
              Shift {shift.id.slice(-8).toUpperCase()}
            </h1>
            <Badge className={isOpen ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'}>
              {shift.status}
            </Badge>
          </div>
          <p className="text-sm text-sand">
            Cashier {shift.cashier.email} · {shift.cashier.role.replace(/_/g, ' ')} · Opened {formatDateTime(shift.openedAt)}
          </p>
        </div>

        <Button variant="outline" asChild>
          <Link href={`/pos/shift-report?shiftId=${shift.id}`}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open print view
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-sand">Opening float</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl text-espresso">{formatRupee(shift.openingFloat)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-sand">Expected cash</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl text-espresso">{formatRupee(shift.expectedCash)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-sand">Sales total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl text-espresso">{formatRupee(shift.totalSalesAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-sand">Net revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-display text-3xl text-espresso">{formatRupee(report.netRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card className="border-mist">
            <CardHeader>
              <CardTitle className="font-display text-espresso">Shift summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-sand">Opened</p>
                <p className="mt-1 text-sm text-espresso">{formatDateTime(shift.openedAt)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-sand">Closed</p>
                <p className="mt-1 text-sm text-espresso">{formatDateTime(shift.closedAt)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-sand">Duration</p>
                <p className="mt-1 text-sm text-espresso">{formatDuration(shift.openedAt, shift.closedAt)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-sand">Cash difference</p>
                <p className="mt-1 text-sm text-espresso">
                  {shift.closure ? formatRupee(shift.closure.cashDifference) : 'Not closed yet'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-mist">
            <CardHeader>
              <CardTitle className="font-display text-espresso">Sales & returns</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-mist p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-sand">Completed sales</p>
                <p className="mt-2 font-display text-3xl text-espresso">{report.sales.totalSalesCount}</p>
                <p className="mt-2 text-sm text-sand">Cash {formatRupee(report.sales.cashSalesAmount)} · Card {formatRupee(report.sales.cardSalesAmount)}</p>
              </div>
              <div className="rounded-lg border border-mist p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-sand">Returns</p>
                <p className="mt-2 font-display text-3xl text-espresso">{report.returns.totalReturnsCount}</p>
                <p className="mt-2 text-sm text-sand">Refunded {formatRupee(report.returns.totalRefundAmount)}</p>
              </div>
            </CardContent>
          </Card>

          <PettyCashSection shiftId={shift.id} isOpen={isOpen} />
        </div>

        <div className="space-y-6">
          <Card className="border-mist">
            <CardHeader>
              <CardTitle className="font-display text-espresso">Cash reconciliation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-sand">Opening float</span>
                <span className="font-mono text-espresso">{formatRupee(report.cashReconciliation.openingFloat)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sand">Cash sales</span>
                <span className="font-mono text-espresso">{formatRupee(report.cashReconciliation.cashSalesAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sand">Cash refunds</span>
                <span className="font-mono text-espresso">{formatRupee(report.cashReconciliation.cashRefundAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sand">Deposits</span>
                <span className="font-mono text-espresso">{formatRupee(report.cashReconciliation.cashDeposited)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sand">Petty cash out</span>
                <span className="font-mono text-espresso">{formatRupee(report.cashReconciliation.pettyCashOut)}</span>
              </div>
              <div className="border-t border-mist pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-espresso">Expected cash</span>
                  <span className="font-mono text-espresso">{formatRupee(report.cashReconciliation.expectedCashInDrawer)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-mist">
            <CardHeader>
              <CardTitle className="font-display text-espresso">Top items sold</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {report.topProductsSold.length === 0 ? (
                <p className="text-sm text-sand">No completed sale lines in this shift yet.</p>
              ) : (
                report.topProductsSold.slice(0, 5).map((item) => (
                  <div key={`${item.productName}-${item.variantDescription}`} className="rounded-lg border border-mist p-3">
                    <p className="font-medium text-espresso">{item.productName}</p>
                    <p className="text-xs text-sand">{item.variantDescription}</p>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-sand">Qty {item.totalQtySold}</span>
                      <span className="font-mono text-espresso">{formatRupee(item.totalRevenue)}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
