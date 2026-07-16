'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  ChevronRight,
  Search,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ClipboardList,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useStockTakeSession, type StockTakeItemDetail } from '@/hooks/useStockTakeSession';

interface StockTakeSessionProps {
  sessionId: string;
  permissions: string[];
}

const PAGE_SIZE = 25;

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }) +
    ', ' +
    d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  );
}

export function StockTakeSession({ sessionId, permissions }: StockTakeSessionProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: sessionRes, isLoading } = useStockTakeSession(sessionId);
  const [currentPage, setCurrentPage] = useState(1);
  const [scanInput, setScanInput] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const scanErrorTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const canManage = permissions.includes('stock:take');
  const stockSession = sessionRes?.data;
  const items = stockSession?.items ?? [];
  const isInProgress = stockSession?.status === 'IN_PROGRESS';

  const countedCount = items.filter((i) => i.countedQuantity !== null).length;
  const totalCount = items.length;
  const progressPct = totalCount > 0 ? Math.round((countedCount / totalCount) * 100) : 0;

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const paginatedItems = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const discrepancyCount = items.filter(
    (i) => i.discrepancy !== null && i.discrepancy !== 0,
  ).length;
  const netVariance = items.reduce((sum, i) => sum + (i.discrepancy ?? 0), 0);

  // Focus scan input on mount
  useEffect(() => {
    if (isInProgress) {
      scanInputRef.current?.focus();
    }
  }, [isInProgress]);

  // Clear scan error after 4 seconds
  useEffect(() => {
    if (scanError) {
      if (scanErrorTimerRef.current) clearTimeout(scanErrorTimerRef.current);
      scanErrorTimerRef.current = setTimeout(() => setScanError(null), 4000);
    }
    return () => {
      if (scanErrorTimerRef.current) clearTimeout(scanErrorTimerRef.current);
    };
  }, [scanError]);

  const handleScanSubmit = useCallback(
    (value: string) => {
      const term = value.trim();
      if (!term) return;

      const matchIdx = items.findIndex(
        (i) =>
          i.variant.barcode?.toLowerCase() === term.toLowerCase() ||
          i.variant.sku.toLowerCase() === term.toLowerCase(),
      );

      if (matchIdx === -1) {
        setScanError(`No item found matching "${term}"`);
        setScanInput('');
        return;
      }

      const matchedItem = items[matchIdx]!;
      const targetPage = Math.floor(matchIdx / PAGE_SIZE) + 1;

      setCurrentPage(targetPage);
      setHighlightedItemId(matchedItem.id);
      setScanError(null);
      setScanInput('');

      // Scroll to and focus the row after page change
      requestAnimationFrame(() => {
        const row = rowRefs.current.get(matchedItem.id);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const countInput = row.querySelector<HTMLInputElement>('input[type="number"]');
          countInput?.focus();
          countInput?.select();
        }
      });

      // Remove highlight after 3 seconds
      setTimeout(() => setHighlightedItemId(null), 3000);
    },
    [items],
  );

  const handleItemUpdate = useCallback(
    async (item: StockTakeItemDetail, countedQuantity: number) => {
      if (isNaN(countedQuantity) || countedQuantity < 0) return;

      try {
        const res = await fetch(
          `/api/store/stock-control/stock-takes/${sessionId}/items/${item.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ countedQuantity }),
          },
        );

        if (!res.ok) {
          toast.error('Failed to save count');
          return;
        }

        setLastSaved(new Date());
        await queryClient.invalidateQueries({ queryKey: ['stock-take-session', sessionId] });
      } catch {
        toast.error('Failed to save count');
      }
    },
    [sessionId, queryClient],
  );

  const handleRecountToggle = useCallback(
    async (item: StockTakeItemDetail, checked: boolean) => {
      try {
        const res = await fetch(
          `/api/store/stock-control/stock-takes/${sessionId}/items/${item.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isRecounted: checked }),
          },
        );

        if (!res.ok) {
          toast.error('Failed to update recount flag');
          return;
        }

        await queryClient.invalidateQueries({ queryKey: ['stock-take-session', sessionId] });
      } catch {
        toast.error('Failed to update recount flag');
      }
    },
    [sessionId, queryClient],
  );

  const handleCompleteClick = useCallback(() => {
    const uncounted = items.filter((i) => i.countedQuantity === null);
    if (uncounted.length > 0) {
      // Find first uncounted item, go to its page, highlight, toast warning
      const firstUncounted = uncounted[0]!;
      const firstIdx = items.findIndex((i) => i.countedQuantity === null);
      const targetPage = Math.floor(firstIdx / PAGE_SIZE) + 1;
      setCurrentPage(targetPage);
      setHighlightedItemId(firstUncounted.id);

      requestAnimationFrame(() => {
        const row = rowRefs.current.get(firstUncounted.id);
        row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });

      toast.warning(`${uncounted.length} item(s) have not been counted yet`);
      setTimeout(() => setHighlightedItemId(null), 3000);
      return;
    }

    setCompleteDialogOpen(true);
  }, [items]);

  const handleCompleteConfirm = useCallback(async () => {
    setCompleting(true);
    try {
      const res = await fetch(
        `/api/store/stock-control/stock-takes/${sessionId}/complete`,
        { method: 'POST' },
      );

      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error?.message ?? 'Failed to complete session');
        return;
      }

      toast.success('Stock take submitted for approval');
      setCompleteDialogOpen(false);
      router.push('/stock-control/stock-takes');
    } catch {
      toast.error('Failed to complete stock take session');
    } finally {
      setCompleting(false);
    }
  }, [sessionId, router]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <div className="space-y-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!stockSession) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-mist">
        <AlertTriangle className="h-12 w-12" />
        <p className="font-body text-lg">Stock take session not found.</p>
        <Link href="/stock-control/stock-takes">
          <Button variant="outline" className="border-sand text-espresso">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Stock Takes
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-mist font-body">
        <Link href="/" className="hover:text-espresso transition-colors">
          Dashboard
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/stock-control" className="hover:text-espresso transition-colors">
          Stock Control
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/stock-control/stock-takes" className="hover:text-espresso transition-colors">
          Stock Takes
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-espresso font-mono text-xs">{sessionId.slice(0, 8)}</span>
      </nav>

      {/* Session Header Card */}
      <Card className="border-sand/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ClipboardList className="h-6 w-6 text-espresso" />
              <CardTitle className="font-display text-xl text-espresso">
                Stock Take Session
              </CardTitle>
            </div>
            <Badge
              className={`font-body text-xs ${
                isInProgress
                  ? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                  : 'bg-amber-100 text-amber-800 hover:bg-amber-100'
              }`}
            >
              {isInProgress && (
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              )}
              {isInProgress ? 'In Progress' : stockSession.status.replace('_', ' ')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="font-body text-xs text-mist uppercase tracking-wider">Scope</p>
              <p className="font-body text-sm text-espresso mt-1">
                {stockSession.categoryId ? 'Category Filter' : 'All Products'}
              </p>
            </div>
            <div>
              <p className="font-body text-xs text-mist uppercase tracking-wider">Started</p>
              <p className="font-body text-sm text-espresso mt-1">
                {formatDateTime(stockSession.startedAt)}
              </p>
            </div>
            <div>
              <p className="font-body text-xs text-mist uppercase tracking-wider">Started By</p>
              <p className="font-body text-sm text-espresso mt-1">
                {stockSession.initiatedBy.email}
              </p>
            </div>
            <div>
              <p className="font-body text-xs text-mist uppercase tracking-wider">Progress</p>
              <p className="font-body text-sm text-espresso mt-1">
                {countedCount} / {totalCount} counted
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="h-2 w-full rounded-full bg-sand/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-espresso transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="font-body text-xs text-mist text-right">{progressPct}%</p>
          </div>
        </CardContent>
      </Card>

      {/* Barcode Scan Input */}
      {isInProgress && (
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-mist" />
              <Input
                ref={scanInputRef}
                type="text"
                placeholder="Scan barcode or enter SKU…"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleScanSubmit(scanInput);
                  }
                }}
                className="h-12 pl-11 text-lg font-mono border-sand focus-visible:ring-espresso"
              />
            </div>
          </div>
          {scanError && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 font-body">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {scanError}
            </div>
          )}
        </div>
      )}

      {/* Items Table */}
      <div className="rounded-lg border border-sand/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-linen/50 hover:bg-linen/50">
              <TableHead className="font-body text-xs text-mist uppercase tracking-wider">
                SKU
              </TableHead>
              <TableHead className="font-body text-xs text-mist uppercase tracking-wider">
                Product
              </TableHead>
              <TableHead className="font-body text-xs text-mist uppercase tracking-wider">
                Variant
              </TableHead>
              <TableHead className="font-body text-xs text-mist uppercase tracking-wider text-center">
                System Count
              </TableHead>
              <TableHead className="font-body text-xs text-mist uppercase tracking-wider text-center">
                Counted
              </TableHead>
              <TableHead className="font-body text-xs text-mist uppercase tracking-wider text-center">
                Discrepancy
              </TableHead>
              {isInProgress && (
                <TableHead className="font-body text-xs text-mist uppercase tracking-wider text-center">
                  Recount
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedItems.map((item) => {
              const variantInfo = [item.variant.size, item.variant.colour]
                .filter(Boolean)
                .join(' / ');
              const isHighlighted = highlightedItemId === item.id;
              const isUncountedHighlight =
                isHighlighted && item.countedQuantity === null;

              return (
                <TableRow
                  key={item.id}
                  ref={(el) => {
                    if (el) rowRefs.current.set(item.id, el);
                  }}
                  className={`transition-colors ${
                    isHighlighted
                      ? 'bg-amber-50 ring-2 ring-amber-300 ring-inset'
                      : isUncountedHighlight
                        ? 'bg-red-50'
                        : 'hover:bg-pearl/50'
                  }`}
                >
                  <TableCell className="font-mono text-xs text-espresso">
                    {item.variant.sku}
                  </TableCell>
                  <TableCell className="font-body text-sm text-espresso">
                    <div>{item.variant.product.name}</div>
                    <div className="text-xs text-mist">{item.variant.product.category.name}</div>
                  </TableCell>
                  <TableCell className="font-body text-sm text-mist">
                    {variantInfo || '—'}
                  </TableCell>
                  <TableCell className="text-center font-mono text-sm text-mist">
                    {item.systemQuantity}
                  </TableCell>
                  <TableCell className="text-center">
                    {isInProgress ? (
                      <Input
                        type="number"
                        min={0}
                        defaultValue={item.countedQuantity ?? ''}
                        onBlur={(e) => {
                          const val = e.target.value;
                          if (val === '') return;
                          const num = parseInt(val, 10);
                          if (num !== item.countedQuantity) {
                            handleItemUpdate(item, num);
                          }
                        }}
                        className="mx-auto h-8 w-20 text-center font-mono text-sm border-sand focus-visible:ring-espresso"
                      />
                    ) : (
                      <span className="font-mono text-sm text-espresso">
                        {item.countedQuantity ?? '—'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-center font-mono text-sm">
                    {item.discrepancy === null ? (
                      <span className="text-mist">—</span>
                    ) : item.discrepancy === 0 ? (
                      <span className="text-green-600">0</span>
                    ) : item.discrepancy > 0 ? (
                      <span className="text-blue-600">+{item.discrepancy}</span>
                    ) : (
                      <span className="text-red-600">{item.discrepancy}</span>
                    )}
                  </TableCell>
                  {isInProgress && (
                    <TableCell className="text-center">
                      <Checkbox
                        checked={item.isRecounted}
                        onCheckedChange={(checked) =>
                          handleRecountToggle(item, checked === true)
                        }
                      />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="font-body text-sm text-mist">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–
            {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount} items
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
              className="border-sand text-espresso"
            >
              Previous
            </Button>
            <span className="font-body text-sm text-mist">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="border-sand text-espresso"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="font-body text-xs text-mist">
          {lastSaved && (
            <span>
              Last saved:{' '}
              {lastSaved.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
              })}
            </span>
          )}
        </div>

        {isInProgress && canManage && (
          <Button
            onClick={handleCompleteClick}
            disabled={completing}
            className="bg-espresso text-pearl hover:bg-espresso/90"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Complete Session
          </Button>
        )}
      </div>

      {/* Completion Confirmation Dialog */}
      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-espresso">
              Complete Stock Take
            </DialogTitle>
            <DialogDescription className="font-body text-mist">
              Review the summary before submitting for approval.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-lg border border-sand/30 p-3 text-center">
                <p className="font-body text-xs text-mist">Items Counted</p>
                <p className="font-display text-xl text-espresso mt-1">{countedCount}</p>
              </div>
              <div className="rounded-lg border border-sand/30 p-3 text-center">
                <p className="font-body text-xs text-mist">Discrepancies</p>
                <p className="font-display text-xl text-terracotta mt-1">{discrepancyCount}</p>
              </div>
              <div className="rounded-lg border border-sand/30 p-3 text-center">
                <p className="font-body text-xs text-mist">Net Variance</p>
                <p
                  className={`font-display text-xl mt-1 ${
                    netVariance > 0
                      ? 'text-blue-600'
                      : netVariance < 0
                        ? 'text-red-600'
                        : 'text-green-600'
                  }`}
                >
                  {netVariance > 0 ? `+${netVariance}` : netVariance}
                </p>
              </div>
            </div>

            {discrepancyCount > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs text-amber-700 font-body">
                  <AlertTriangle className="mr-1 inline-block h-3.5 w-3.5" />
                  {discrepancyCount} item(s) have discrepancies that will need to be reviewed and
                  approved.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCompleteDialogOpen(false)}
              className="border-sand text-espresso"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCompleteConfirm}
              disabled={completing}
              className="bg-espresso text-pearl hover:bg-espresso/90"
            >
              {completing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Complete &amp; Submit for Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
