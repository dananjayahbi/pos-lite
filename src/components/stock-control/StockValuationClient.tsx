'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpDown, Download, Lock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePermissions } from '@/hooks/usePermissions';
import { useGetStockValuation, useInvalidateStockValuation } from '@/hooks/useGetStockValuation';
import { formatRupee } from '@/lib/format';

type SortColumn = 'categoryName' | 'variantCount' | 'retailValue' | 'costValue' | 'marginPercent' | 'share';
type SortDirection = 'asc' | 'desc';

function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

function marginColor(percent: number): string {
  if (percent >= 30) return 'text-green-600';
  if (percent >= 10) return 'text-amber-600';
  return 'text-red-600';
}

export function StockValuationClient() {
  const { hasPermission, isLoading: permLoading } = usePermissions();
  const { data, isLoading, isError, error } = useGetStockValuation();
  const invalidate = useInvalidateStockValuation();
  const [sortColumn, setSortColumn] = useState<SortColumn>('retailValue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  if (permLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!hasPermission('product:view_cost_price')) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sand/30">
              <Lock className="h-6 w-6 text-mist" />
            </div>
            <CardTitle className="font-display text-xl text-espresso">Access Restricted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-body text-sm text-mist">
              You do not have permission to view stock valuation data. Contact your administrator if you need access.
            </p>
            <Link
              href="/stock-control"
              className="mt-4 inline-block font-body text-sm text-espresso underline hover:text-terracotta"
            >
              Back to Stock Control
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    try {
      await invalidate();
      toast.success('Valuation refreshed');
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const res = await fetch('/api/store/stock-control/valuation?format=csv');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stock-valuation-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Valuation report exported');
    } catch {
      toast.error('Failed to export valuation report');
    } finally {
      setIsExporting(false);
    }
  }

  function handleSort(column: SortColumn) {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  }

  const valuation = data?.data;
  const totalRetail = valuation?.retailValue ?? 0;

  const sortedCategories = valuation
    ? [...valuation.categoryBreakdown]
        .map((cat) => {
          const mp = cat.retailValue > 0 ? ((cat.retailValue - cat.costValue) / cat.retailValue) * 100 : 0;
          const share = totalRetail > 0 ? (cat.retailValue / totalRetail) * 100 : 0;
          return { ...cat, marginPercent: mp, share };
        })
        .sort((a, b) => {
          const aVal = a[sortColumn];
          const bVal = b[sortColumn];
          if (typeof aVal === 'string' && typeof bVal === 'string') {
            return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
          }
          const aNum = Number(aVal);
          const bNum = Number(bVal);
          return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        })
    : [];

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <nav className="font-body text-sm text-mist">
        <Link href="/stock-control" className="hover:text-espresso">
          Stock Control
        </Link>
        <span className="mx-2">→</span>
        <span className="text-espresso">Stock Valuation</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-espresso">Stock Valuation</h1>
          {valuation && (
            <p className="mt-1 font-body text-sm text-mist">As of {formatTimestamp(valuation.calculatedAt)}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing || isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Recalculating…' : 'Refresh'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting || isLoading}>
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6">
            <p className="font-body text-sm text-red-700">
              {error instanceof Error ? error.message : 'Failed to load stock valuation data.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* KPI cards */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      ) : valuation ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-body text-sm font-medium text-mist">Total Retail Value</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-2xl font-semibold text-espresso">
                  {formatRupee(valuation.retailValue)}
                </p>
                <p className="mt-1 font-body text-xs text-mist">What your stock could sell for</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-body text-sm font-medium text-mist">Total Cost Value</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-2xl font-semibold text-espresso">
                  {formatRupee(valuation.costValue)}
                </p>
                <p className="mt-1 font-body text-xs text-mist">What your current stock cost to acquire</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-body text-sm font-medium text-mist">Estimated Gross Margin</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`font-display text-2xl font-semibold ${marginColor(valuation.estimatedMarginPercent)}`}>
                  {valuation.estimatedMarginPercent.toFixed(1)}%
                </p>
                <p className="mt-1 font-body text-xs text-mist">{formatRupee(valuation.estimatedMargin)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-body text-sm font-medium text-mist">Variants in Stock</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-2xl font-semibold text-espresso">
                  {valuation.variantCount.toLocaleString()}
                </p>
                <p className="mt-1 font-body text-xs text-mist">Active product variants with stock</p>
              </CardContent>
            </Card>
          </div>

          {/* Info note */}
          <div className="rounded-lg border border-sand bg-linen px-4 py-3">
            <p className="font-body text-xs text-mist">
              Values are based on current stock quantities multiplied by retail and cost prices. Actual margins may differ
              due to discounts, promotions, or price changes.
            </p>
          </div>

          {/* Category Breakdown */}
          <div>
            <h2 className="mb-4 font-display text-lg font-semibold text-espresso">Category Breakdown</h2>
            <div className="overflow-x-auto rounded-lg border border-sand/30 bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-pearl">
                    <TableHead>
                      <button
                        type="button"
                        className="flex items-center gap-1 font-body text-xs font-medium text-mist hover:text-espresso"
                        onClick={() => handleSort('categoryName')}
                      >
                        Category <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        type="button"
                        className="ml-auto flex items-center gap-1 font-body text-xs font-medium text-mist hover:text-espresso"
                        onClick={() => handleSort('variantCount')}
                      >
                        Variants <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        type="button"
                        className="ml-auto flex items-center gap-1 font-body text-xs font-medium text-mist hover:text-espresso"
                        onClick={() => handleSort('retailValue')}
                      >
                        Retail Value <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        type="button"
                        className="ml-auto flex items-center gap-1 font-body text-xs font-medium text-mist hover:text-espresso"
                        onClick={() => handleSort('costValue')}
                      >
                        Cost Value <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        type="button"
                        className="ml-auto flex items-center gap-1 font-body text-xs font-medium text-mist hover:text-espresso"
                        onClick={() => handleSort('marginPercent')}
                      >
                        Margin % <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="text-right">
                      <button
                        type="button"
                        className="ml-auto flex items-center gap-1 font-body text-xs font-medium text-mist hover:text-espresso"
                        onClick={() => handleSort('share')}
                      >
                        Share of Total <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCategories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center font-body text-sm text-mist">
                        No category data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedCategories.map((cat) => (
                      <TableRow key={cat.categoryId}>
                        <TableCell className="font-body text-sm font-medium text-espresso">{cat.categoryName}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-espresso">{cat.variantCount}</TableCell>
                        <TableCell className="text-right font-mono text-sm text-espresso">
                          {formatRupee(cat.retailValue)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-espresso">
                          {formatRupee(cat.costValue)}
                        </TableCell>
                        <TableCell className={`text-right font-mono text-sm ${marginColor(cat.marginPercent)}`}>
                          {cat.marginPercent.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-mono text-sm text-espresso">{cat.share.toFixed(1)}%</span>
                            <div className="h-2 w-16 overflow-hidden rounded-full bg-sand/30">
                              <div
                                className="h-full rounded-full bg-espresso"
                                style={{ width: `${Math.min(cat.share, 100)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
