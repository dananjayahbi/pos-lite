'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  PackageSearch,
  Search,
  ShieldX,
  X,
} from 'lucide-react';
import { STOCK_MOVEMENT_REASONS } from '@/lib/constants/stock-movement';
import { mergeSearchParams } from '@/lib/urlUtils';
import { useGlobalStockMovements } from '@/hooks/useGlobalStockMovements';
import { useStockActors } from '@/hooks/useStockActors';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ── Constants ────────────────────────────────────────────────────────────────

const REASON_LABELS: Record<string, string> = {
  FOUND: 'Found',
  DAMAGED: 'Damaged',
  STOLEN: 'Stolen or Lost',
  DATA_ERROR: 'Data Entry Correction',
  RETURNED_TO_SUPPLIER: 'Returned to Supplier',
  INITIAL_STOCK: 'Initial Stock Entry',
  SALE_RETURN: 'Customer Return',
  PURCHASE_RECEIVED: 'Received from Purchase',
  STOCK_TAKE_ADJUSTMENT: 'Stock Take Adjustment',
  SALE: 'Sale',
  VOID_REVERSAL: 'Void Reversal',
};

const REASON_BADGE_VARIANT: Record<string, 'success' | 'destructive' | 'info' | 'warning'> = {
  FOUND: 'success',
  INITIAL_STOCK: 'success',
  PURCHASE_RECEIVED: 'success',
  DAMAGED: 'destructive',
  STOLEN: 'destructive',
  DATA_ERROR: 'info',
  STOCK_TAKE_ADJUSTMENT: 'info',
  RETURNED_TO_SUPPLIER: 'warning',
  SALE_RETURN: 'warning',
  SALE: 'info',
  VOID_REVERSAL: 'warning',
};

const REASON_DOT_COLOR: Record<string, string> = {
  FOUND: 'bg-green-500',
  INITIAL_STOCK: 'bg-green-500',
  PURCHASE_RECEIVED: 'bg-green-500',
  DAMAGED: 'bg-red-500',
  STOLEN: 'bg-red-500',
  DATA_ERROR: 'bg-blue-500',
  STOCK_TAKE_ADJUSTMENT: 'bg-blue-500',
  RETURNED_TO_SUPPLIER: 'bg-amber-500',
  SALE_RETURN: 'bg-amber-500',
  SALE: 'bg-blue-400',
  VOID_REVERSAL: 'bg-amber-400',
};

const ALL_REASONS = [...STOCK_MOVEMENT_REASONS];
const PAGE_SIZE = 25;

function formatDate(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date}, ${time}`;
}

function getDefaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

// ── Component ────────────────────────────────────────────────────────────────

interface StockMovementHistoryProps {
  permissions: string[];
}

export function StockMovementHistory({ permissions }: StockMovementHistoryProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Permission guard ───────────────────────────────────────────────────────
  if (!permissions.includes('stock:view')) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
            <ShieldX className="h-12 w-12 text-mist" />
            <h2 className="font-display text-xl text-espresso">Access Denied</h2>
            <p className="text-sm text-mist">You don&apos;t have permission to view stock movements.</p>
            <Button variant="outline" asChild>
              <Link href="/stock-control">Back to Stock Control</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <StockMovementHistoryInner />;
}

function StockMovementHistoryInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Read filters from URL ──────────────────────────────────────────────────
  const page = Number(searchParams.get('page') ?? '1');
  const from = searchParams.get('from') ?? getDefaultFrom();
  const to = searchParams.get('to') ?? '';
  const reasonsParam = searchParams.get('reasons') ?? ALL_REASONS.join(',');
  const search = searchParams.get('search') ?? '';
  const actorId = searchParams.get('actorId') ?? '';
  const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') ?? 'desc';

  const selectedReasons = useMemo(() => new Set(reasonsParam.split(',').filter(Boolean)), [reasonsParam]);

  // ── Local state for debounced search ───────────────────────────────────────
  const [searchInput, setSearchInput] = useState(search);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const qs = mergeSearchParams(searchParams, updates);
      router.push(`/stock-control/movements${qs ? `?${qs}` : ''}`);
    },
    [router, searchParams],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateParams({ search: value || null, page: '1' });
      }, 300);
    },
    [updateParams],
  );

  // ── Data fetching ──────────────────────────────────────────────────────────
  const filters = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      from: from || undefined,
      to: to || undefined,
      reasons: reasonsParam !== ALL_REASONS.join(',') ? reasonsParam : undefined,
      search: search || undefined,
      actorId: actorId || undefined,
      sortOrder,
    }),
    [page, from, to, reasonsParam, search, actorId, sortOrder],
  );

  const { data, isLoading } = useGlobalStockMovements(filters);
  const { data: actorsData } = useStockActors();

  const movements = data?.data ?? [];
  const meta = data?.meta;
  const actors = actorsData?.data ?? [];

  // ── CSV export ─────────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (reasonsParam !== ALL_REASONS.join(',')) params.set('reasons', reasonsParam);
      if (search) params.set('search', search);
      if (actorId) params.set('actorId', actorId);
      params.set('sortOrder', sortOrder);
      params.set('format', 'csv');

      const res = await fetch(`/api/store/stock-control/movements?${params}`);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        from || to
          ? `stock-movements-${from || ''}-to-${to || ''}.csv`
          : 'stock-movements-all.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail — could add toast if desired
    } finally {
      setExporting(false);
    }
  }, [from, to, reasonsParam, search, actorId, sortOrder]);

  // ── Reason chip toggle ─────────────────────────────────────────────────────
  const toggleReason = useCallback(
    (reason: string) => {
      const next = new Set(selectedReasons);
      if (next.has(reason)) {
        next.delete(reason);
      } else {
        next.add(reason);
      }
      const value = next.size === ALL_REASONS.length ? null : [...next].join(',');
      updateParams({ reasons: value || null, page: '1' });
    },
    [selectedReasons, updateParams],
  );

  // ── Sort toggle ────────────────────────────────────────────────────────────
  const toggleSort = useCallback(() => {
    updateParams({ sortOrder: sortOrder === 'desc' ? 'asc' : 'desc' });
  }, [sortOrder, updateParams]);

  // ── Active filters detection ───────────────────────────────────────────────
  const hasNonDefaultFilters =
    from !== getDefaultFrom() ||
    to !== '' ||
    reasonsParam !== ALL_REASONS.join(',') ||
    search !== '' ||
    actorId !== '';

  const clearAllFilters = useCallback(() => {
    router.push('/stock-control/movements');
  }, [router]);

  // ── Pagination helpers ─────────────────────────────────────────────────────
  const startItem = meta ? (meta.page - 1) * meta.limit + 1 : 0;
  const endItem = meta ? Math.min(meta.page * meta.limit, meta.total) : 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-mist">
        <Link href="/" className="hover:text-espresso transition-colors">Dashboard</Link>
        <span>/</span>
        <Link href="/stock-control" className="hover:text-espresso transition-colors">Stock Control</Link>
        <span>/</span>
        <span className="text-espresso">Movement History</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-espresso">Stock Movement History</h1>
          <p className="mt-1 font-body text-sm text-mist">View and export all stock movements across your inventory.</p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Export CSV
        </Button>
      </div>

      {actors.length > 0 && (
        <Card className="bg-pearl">
          <CardContent className="space-y-3 pt-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-espresso">People changing stock</p>
                <p className="mt-1 text-xs text-mist">
                  {actors.length} staff member{actors.length === 1 ? '' : 's'} appear in the stock audit trail.
                </p>
              </div>
              {actorId && (
                <Badge variant="secondary" className="w-fit">
                  Filtered to {actors.find((actor) => actor.id === actorId)?.email ?? actorId}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {actors.slice(0, 8).map((actor) => {
                const active = actor.id === actorId;
                return (
                  <button
                    key={actor.id}
                    onClick={() => updateParams({ actorId: active ? null : actor.id, page: '1' })}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      active
                        ? 'border-terracotta bg-white text-espresso'
                        : 'border-mist/50 bg-linen/50 text-mist hover:text-espresso'
                    }`}
                  >
                    {actor.email}
                  </button>
                );
              })}
              {actors.length > 8 && (
                <span className="rounded-full border border-mist/40 px-3 py-1 text-xs text-mist">
                  +{actors.length - 8} more in filter list
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Bar */}
      <Card className="bg-pearl">
        <CardContent className="space-y-4 pt-4">
          {/* Row 1: dates + search + actor */}
          <div className="flex flex-wrap items-end gap-3">
            {/* From */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-mist">From</label>
              <div className="flex items-center gap-1">
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => updateParams({ from: e.target.value || null, page: '1' })}
                  className="h-9 w-40"
                />
                {from && (
                  <button
                    onClick={() => updateParams({ from: null, page: '1' })}
                    className="text-mist hover:text-espresso"
                    aria-label="Clear from date"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* To */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-mist">To</label>
              <div className="flex items-center gap-1">
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => updateParams({ to: e.target.value || null, page: '1' })}
                  className="h-9 w-40"
                />
                {to && (
                  <button
                    onClick={() => updateParams({ to: null, page: '1' })}
                    className="text-mist hover:text-espresso"
                    aria-label="Clear to date"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Search */}
            <div className="space-y-1 flex-1 min-w-50">
              <label className="text-xs font-medium text-mist">Product / SKU</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-mist" />
                <Input
                  placeholder="Search by product name or SKU..."
                  value={searchInput}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="h-9 pl-9"
                />
              </div>
            </div>

            {/* Actor */}
            <div className="space-y-1 min-w-45">
              <label className="text-xs font-medium text-mist">Staff</label>
              <Select
                value={actorId || '__all__'}
                onValueChange={(v) => updateParams({ actorId: v === '__all__' ? null : v, page: '1' })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Staff</SelectItem>
                  {actors.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: reason chips */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-mist">Reasons</label>
            <div className="flex flex-wrap gap-2">
              {ALL_REASONS.map((r) => {
                const active = selectedReasons.has(r);
                return (
                  <button
                    key={r}
                    onClick={() => toggleReason(r)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'border-sand bg-white text-espresso'
                        : 'border-transparent bg-linen/50 text-mist'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${REASON_DOT_COLOR[r]}`} />
                    {REASON_LABELS[r]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clear all */}
          {hasNonDefaultFilters && (
            <button
              onClick={clearAllFilters}
              className="text-xs font-medium text-terracotta hover:underline"
            >
              Clear All Filters
            </button>
          )}
        </CardContent>
      </Card>

      {/* Active Filter Pills */}
      {hasNonDefaultFilters && (
        <div className="flex flex-wrap gap-2">
          {from && from !== getDefaultFrom() && (
            <Badge variant="secondary" className="gap-1">
              From: {from}
              <button onClick={() => updateParams({ from: null, page: '1' })} aria-label="Remove from filter">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {to && (
            <Badge variant="secondary" className="gap-1">
              To: {to}
              <button onClick={() => updateParams({ to: null, page: '1' })} aria-label="Remove to filter">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {search && (
            <Badge variant="secondary" className="gap-1">
              Search: {search}
              <button onClick={() => { setSearchInput(''); updateParams({ search: null, page: '1' }); }} aria-label="Remove search filter">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {actorId && (
            <Badge variant="secondary" className="gap-1">
              Staff: {actors.find((a) => a.id === actorId)?.email ?? actorId}
              <button onClick={() => updateParams({ actorId: null, page: '1' })} aria-label="Remove actor filter">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {reasonsParam !== ALL_REASONS.join(',') && (
            <Badge variant="secondary" className="gap-1">
              {selectedReasons.size} of {ALL_REASONS.length} reasons
              <button onClick={() => updateParams({ reasons: null, page: '1' })} aria-label="Reset reasons filter">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-sand/30 bg-pearl overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button onClick={toggleSort} className="inline-flex items-center gap-1 hover:text-espresso">
                  Date &amp; Time
                  {sortOrder === 'desc' ? <ArrowDown className="h-3.5 w-3.5" /> : <ArrowUp className="h-3.5 w-3.5" />}
                </button>
              </TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Change</TableHead>
              <TableHead className="text-right">Before</TableHead>
              <TableHead className="text-right">After</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 7 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : movements.length === 0
                ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-40">
                        <div className="flex flex-col items-center justify-center gap-2 text-mist">
                          <PackageSearch className="h-10 w-10" />
                          <p className="text-sm">No stock movements found for the selected filters</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                : movements.map((m) => {
                    const isLow = m.quantityAfter <= m.variant.lowStockThreshold;
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDate(m.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/inventory/${m.variant.product.id}`}
                            className="text-sm font-medium text-espresso hover:underline"
                          >
                            {m.variant.product.name}
                          </Link>
                          <span className="block text-xs text-mist">{m.variant.product.category.name}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs">{m.variant.sku}</span>
                          {(m.variant.size || m.variant.colour) && (
                            <span className="ml-1.5 text-xs text-mist">
                              {[m.variant.size, m.variant.colour].filter(Boolean).join(' / ')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={REASON_BADGE_VARIANT[m.reason] ?? 'secondary'}>
                            {REASON_LABELS[m.reason] ?? m.reason}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          <span className={m.quantityDelta > 0 ? 'text-green-600' : 'text-red-600'}>
                            {m.quantityDelta > 0 ? `+${m.quantityDelta}` : m.quantityDelta}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm text-mist">{m.quantityBefore}</TableCell>
                        <TableCell className={`text-right text-sm font-medium ${isLow ? 'text-red-600' : 'text-espresso'}`}>
                          {m.quantityAfter}
                        </TableCell>
                        <TableCell className="text-sm text-mist">{m.actor.email}</TableCell>
                        <TableCell className="max-w-50 text-sm text-mist">
                          {m.note ? (
                            <span title={m.note}>{truncate(m.note, 60)}</span>
                          ) : (
                            <span className="text-mist/50">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 0 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-mist">
            Showing {startItem}–{endItem} of {meta.total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => updateParams({ page: String(page - 1) })}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <span className="text-espresso font-medium">
              Page {meta.page} of {meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => updateParams({ page: String(page + 1) })}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
