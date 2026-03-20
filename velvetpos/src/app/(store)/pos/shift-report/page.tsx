'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft,
  Printer,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRupee } from '@/lib/format';
import type { ZReportData } from '@/lib/services/shift.service';

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
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

async function fetchZReport(shiftId: string): Promise<ZReportData> {
  const res = await fetch(`/api/store/shifts/${shiftId}/z-report`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Failed to load Z-Report (${res.status})`);
  }
  const json = await res.json();
  return json.data as ZReportData;
}

function Row({ label, value, className }: { label: string; value: string; className?: string | undefined }) {
  return (
    <div className={`flex justify-between py-1.5 ${className ?? ''}`}>
      <span className="text-espresso/70 font-body">{label}</span>
      <span className="font-mono text-espresso">{value}</span>
    </div>
  );
}

export default function ShiftReportPage() {
  const searchParams = useSearchParams();
  const shiftId = searchParams.get('shiftId');
  const [topItemsOpen, setTopItemsOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['z-report', shiftId],
    queryFn: () => fetchZReport(shiftId!),
    enabled: !!shiftId,
  });

  if (!shiftId) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-espresso">
        <AlertCircle className="h-10 w-10 text-terracotta" />
        <p className="font-body text-lg">No shift ID provided.</p>
        <Link href="/pos/history" className="text-sm text-sand underline font-body">
          Go to Shift History
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-espresso">
        <AlertCircle className="h-10 w-10 text-terracotta" />
        <p className="font-body text-lg">{(error as Error)?.message ?? 'Failed to load report'}</p>
        <Link href="/pos/history" className="text-sm text-sand underline font-body">
          Go to Shift History
        </Link>
      </div>
    );
  }

  const { shift, sales, returns, cashReconciliation, netRevenue, topProductsSold } = data;
  const isOpen = shift.status === 'OPEN';

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 print:p-2 print:max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/pos/history"
          className="inline-flex items-center gap-1.5 text-sm text-sand hover:text-espresso font-body transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Shift History
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          className="gap-1.5 border-sand text-espresso"
        >
          <Printer className="h-4 w-4" />
          Print
        </Button>
      </div>

      <h1 className="font-display text-2xl text-espresso print:text-xl">Z-Report</h1>

      {isOpen && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm font-body text-amber-800">
          <Clock className="h-4 w-4 shrink-0" />
          This shift is still open. Data reflects the current in-progress state.
        </div>
      )}

      {/* 1. Shift Summary */}
      <section className="rounded-lg border border-mist bg-white p-4 space-y-1">
        <h2 className="font-display text-lg text-espresso mb-2">Shift Summary</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          <Row label="Shift ID" value={shift.id.slice(-8).toUpperCase()} />
          <Row label="Cashier" value={shift.cashierName} />
          <Row label="Opened" value={formatDateTime(shift.openedAt)} />
          <Row label="Closed" value={shift.closedAt ? formatDateTime(shift.closedAt) : '—'} />
          <Row label="Duration" value={formatDuration(shift.openedAt, shift.closedAt)} />
          <Row label="Status" value={shift.status} />
        </div>
        {shift.notes && (
          <p className="mt-2 text-sm text-espresso/60 font-body italic">
            Notes: {shift.notes}
          </p>
        )}
      </section>

      {/* 2. Sales Summary */}
      <section className="rounded-lg border border-mist bg-white p-4 space-y-1">
        <h2 className="font-display text-lg text-espresso mb-2">Sales Summary</h2>
        <Row label="Total Completed Sales" value={String(sales.totalSalesCount)} />
        <Row label="Total Sales Amount" value={formatRupee(sales.totalSalesAmount)} />
        <Row label="Cash Sales" value={formatRupee(sales.cashSalesAmount)} />
        <Row label="Card Sales" value={formatRupee(sales.cardSalesAmount)} />
        <Row label="Voided Sales" value={String(sales.voidedSalesCount)} />
        <Row label="Total Discounts Given" value={formatRupee(sales.totalDiscountAmount)} />
      </section>

      {/* 3. Returns Summary */}
      <section className="rounded-lg border border-mist bg-white p-4 space-y-1">
        <h2 className="font-display text-lg text-espresso mb-2">Returns Summary</h2>
        <Row label="Total Returns" value={String(returns.totalReturnsCount)} />
        <Row label="Total Refund Amount" value={formatRupee(returns.totalRefundAmount)} />
        <Row label="Cash Refunds" value={formatRupee(returns.cashRefundAmount)} />
        <Row label="Card Reversals" value={formatRupee(returns.cardRefundAmount)} />
        <Row label="Store Credit Issued" value={formatRupee(returns.creditRefundAmount)} />
        <Row label="Exchanges" value={String(returns.exchangeCount)} />
      </section>

      {/* 4. Net Revenue */}
      <section className="rounded-lg border-2 border-espresso bg-linen p-5 text-center">
        <p className="font-body text-sm text-espresso/70 mb-1">Net Revenue</p>
        <p className="font-mono text-3xl text-espresso">{formatRupee(netRevenue)}</p>
        <p className="font-body text-xs text-espresso/50 mt-1">Sales − Returns</p>
      </section>

      {/* 5. Cash Reconciliation */}
      <section className="rounded-lg border border-mist bg-white p-4 space-y-1">
        <h2 className="font-display text-lg text-espresso mb-2">Cash Reconciliation</h2>
        <Row label="Opening Float" value={formatRupee(cashReconciliation.openingFloat)} />
        <Row label="+ Cash Sales" value={formatRupee(cashReconciliation.cashSalesAmount)} />
        <Row label="− Cash Refunds" value={formatRupee(cashReconciliation.cashRefundAmount)} />
        <div className="border-t border-mist my-1" />
        <Row
          label="Expected Cash in Drawer"
          value={formatRupee(cashReconciliation.expectedCashInDrawer)}
          className="font-semibold"
        />
        <Row
          label="Actual Cash Counted"
          value={cashReconciliation.actualCashCounted !== null ? formatRupee(cashReconciliation.actualCashCounted) : '—'}
        />
        {cashReconciliation.cashDifference !== null && (
          <Row
            label="Difference"
            value={`${cashReconciliation.cashDifference >= 0 ? '+' : ''}${formatRupee(cashReconciliation.cashDifference)}`}
            className={
              cashReconciliation.cashDifference === 0
                ? ''
                : cashReconciliation.cashDifference > 0
                  ? 'text-green-600'
                  : 'text-red-500'
            }
          />
        )}
      </section>

      {/* 6. Top Items Sold */}
      {topProductsSold.length > 0 && (
        <section className="rounded-lg border border-mist bg-white p-4">
          <button
            type="button"
            onClick={() => setTopItemsOpen((v) => !v)}
            className="flex w-full items-center justify-between font-display text-lg text-espresso print:pointer-events-none"
          >
            Top Items Sold
            {topItemsOpen ? (
              <ChevronUp className="h-5 w-5 print:hidden" />
            ) : (
              <ChevronDown className="h-5 w-5 print:hidden" />
            )}
          </button>
          {(topItemsOpen || false) && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm font-body">
                <thead>
                  <tr className="border-b border-mist text-left text-espresso/60">
                    <th className="py-2 pr-4">Product</th>
                    <th className="py-2 pr-4">Variant</th>
                    <th className="py-2 pr-4 text-right">Qty</th>
                    <th className="py-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topProductsSold.map((item, i) => (
                    <tr key={i} className="border-b border-mist/50 last:border-0">
                      <td className="py-2 pr-4 text-espresso">{item.productName}</td>
                      <td className="py-2 pr-4 text-espresso/70">{item.variantDescription}</td>
                      <td className="py-2 pr-4 text-right font-mono text-espresso">{item.totalQtySold}</td>
                      <td className="py-2 text-right font-mono text-espresso">{formatRupee(item.totalRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* Always show in print */}
          <div className="hidden print:block mt-3 overflow-x-auto">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="border-b border-mist text-left text-espresso/60">
                  <th className="py-2 pr-4">Product</th>
                  <th className="py-2 pr-4">Variant</th>
                  <th className="py-2 pr-4 text-right">Qty</th>
                  <th className="py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {topProductsSold.map((item, i) => (
                  <tr key={i} className="border-b border-mist/50 last:border-0">
                    <td className="py-2 pr-4 text-espresso">{item.productName}</td>
                    <td className="py-2 pr-4 text-espresso/70">{item.variantDescription}</td>
                    <td className="py-2 pr-4 text-right font-mono text-espresso">{item.totalQtySold}</td>
                    <td className="py-2 text-right font-mono text-espresso">{formatRupee(item.totalRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          nav, header, .print\\:hidden { display: none !important; }
          body { font-family: 'JetBrains Mono', monospace; font-size: 11px; }
          section { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
