'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { Download, PackageCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLowStockVariants } from '@/hooks/useLowStockVariants';
import { formatRupee } from '@/lib/format';

interface LowStockListProps {
  permissions: string[];
}

export function LowStockList({ permissions }: LowStockListProps) {
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [useOverride, setUseOverride] = useState(false);
  const [thresholdOverride, setThresholdOverride] = useState(5);
  const [exporting, setExporting] = useState(false);

  const threshold = useOverride ? thresholdOverride : undefined;

  const { data, isLoading } = useLowStockVariants({ page, limit, threshold });

  const variants = data?.data ?? [];
  const meta = data?.meta;
  const total = meta?.total ?? 0;
  const totalPages = meta?.totalPages ?? 1;

  const canView = permissions.includes('stock:view');

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ format: 'csv' });
      if (threshold != null) params.set('threshold', String(threshold));
      const res = await fetch(`/api/store/stock-control/low-stock?${params}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const today = new Date().toISOString().split('T')[0];
      a.download = `low-stock-${today}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('CSV exported successfully');
    } catch {
      toast.error('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  }, [threshold]);

  if (!canView) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="font-body text-sm text-mist">You do not have permission to view stock data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <nav className="font-body text-sm text-mist">
        <Link href="/" className="hover:text-espresso">
          Dashboard
        </Link>
        <span className="mx-2">→</span>
        <Link href="/stock-control" className="hover:text-espresso">
          Stock Control
        </Link>
        <span className="mx-2">→</span>
        <span className="text-espresso">Low Stock</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-espresso">Low Stock Variants</h1>
            {!isLoading && (
              <Badge
                variant="secondary"
                className="bg-amber-100 text-amber-800 hover:bg-amber-100"
              >
                {total}
              </Badge>
            )}
          </div>
          <p className="mt-1 font-body text-sm text-mist">
            Variants at or below their low stock threshold — sorted by urgency.
          </p>
        </div>
        <Button
          variant="outline"
          className="border-sand text-espresso"
          onClick={handleExport}
          disabled={exporting || total === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>

      {/* Threshold filter */}
      <div className="flex items-center gap-4 rounded-lg border border-sand/40 bg-white px-4 py-3">
        <label className="flex items-center gap-2 font-body text-sm text-espresso">
          <input
            type="checkbox"
            checked={useOverride}
            onChange={(e) => {
              setUseOverride(e.target.checked);
              setPage(1);
            }}
            className="rounded border-sand"
          />
          Override threshold
        </label>
        {useOverride && (
          <Input
            type="number"
            min={1}
            value={thresholdOverride}
            onChange={(e) => {
              setThresholdOverride(Math.max(1, parseInt(e.target.value, 10) || 1));
              setPage(1);
            }}
            className="w-24 border-sand"
          />
        )}
        {!useOverride && (
          <span className="font-body text-xs text-mist">
            Using individual per-variant thresholds
          </span>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : variants.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-green-200 bg-green-50 py-16">
          <PackageCheck className="h-12 w-12 text-green-500" />
          <p className="font-body text-lg font-medium text-green-800">
            All variants are adequately stocked
          </p>
          <p className="font-body text-sm text-green-600">
            No variants are currently at or below their low stock threshold.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-sand/40">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-body">Product</TableHead>
                  <TableHead className="font-body">Variant</TableHead>
                  <TableHead className="font-body text-center">Current Stock</TableHead>
                  <TableHead className="font-body text-center">Threshold</TableHead>
                  <TableHead className="font-body text-center">Shortfall</TableHead>
                  <TableHead className="font-body text-right">Retail Price</TableHead>
                  <TableHead className="font-body text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variants.map((v) => {
                  const isOutOfStock = v.stock_quantity === 0;
                  return (
                    <TableRow key={v.id}>
                      <TableCell>
                        <div>
                          <p className="font-body text-sm font-medium text-espresso">
                            {v.product_name}
                          </p>
                          <p className="font-body text-xs text-mist">{v.category_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-mono text-sm text-espresso">{v.sku}</p>
                        {(v.size || v.colour) && (
                          <p className="font-body text-xs text-mist">
                            {[v.size, v.colour].filter(Boolean).join(' / ')}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="secondary"
                          className={
                            isOutOfStock
                              ? 'bg-red-100 text-red-800 hover:bg-red-100'
                              : 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                          }
                        >
                          {v.stock_quantity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-body text-sm text-espresso">
                        {v.low_stock_threshold}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-body text-sm font-bold text-red-600">
                          -{v.shortfall}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-body text-sm text-espresso">
                        {formatRupee(v.retail_price)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" className="border-sand text-espresso" asChild>
                          <Link href={`/stock-control/adjust?variantId=${v.id}`}>
                            Adjust Stock
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="font-body text-sm text-mist">
                Page {page} of {totalPages} ({total} {total === 1 ? 'variant' : 'variants'})
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-sand"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-sand"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
