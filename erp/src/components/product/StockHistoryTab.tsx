'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';
import { useStockMovements } from '@/hooks/useStockMovements';

// ── Reason badge ─────────────────────────────────────────────────────────────

const REASON_STYLES: Record<string, { bg: string; text: string }> = {
  SALE_RETURN: { bg: 'bg-sand/40', text: 'text-espresso' },
  FOUND: { bg: 'bg-sand/30', text: 'text-espresso' },
  DAMAGED: { bg: 'bg-terracotta/20', text: 'text-terracotta' },
  STOLEN: { bg: 'bg-terracotta/30', text: 'text-terracotta' },
  DATA_ERROR: { bg: 'bg-mist/30', text: 'text-espresso' },
  RETURNED_TO_SUPPLIER: { bg: 'bg-mist/40', text: 'text-espresso' },
  INITIAL_STOCK: { bg: 'bg-espresso/10', text: 'text-espresso' },
  PURCHASE_RECEIVED: { bg: 'bg-espresso/15', text: 'text-espresso' },
  STOCK_TAKE_ADJUSTMENT: { bg: 'bg-sand/30', text: 'text-espresso' },
};

function ReasonBadge({ reason }: { reason: string }) {
  const style = REASON_STYLES[reason] ?? { bg: 'bg-mist/20', text: 'text-espresso' };
  const label = reason
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}
    >
      {label}
    </span>
  );
}

// ── Date formatting ──────────────────────────────────────────────────────────

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

// ── Component ────────────────────────────────────────────────────────────────

interface StockHistoryTabProps {
  productId: string;
}

export function StockHistoryTab({ productId }: StockHistoryTabProps) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const limit = 25;

  const { data, isLoading } = useStockMovements({
    productId,
    from: from || undefined,
    to: to || undefined,
    page,
    limit,
  });

  const movements = data?.data ?? [];
  const meta = data?.meta ?? { page: 1, limit: 25, total: 0, totalPages: 0 };

  return (
    <div className="space-y-4">
      {/* Date range filters */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-sand/30 bg-pearl p-4">
        <div className="space-y-1.5">
          <Label htmlFor="stock-from" className="font-body text-xs text-mist uppercase tracking-wider">
            From
          </Label>
          <Input
            id="stock-from"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="w-40 border-sand font-body text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stock-to" className="font-body text-xs text-mist uppercase tracking-wider">
            To
          </Label>
          <Input
            id="stock-to"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="w-40 border-sand font-body text-sm"
          />
        </div>
        {(from || to) && (
          <Button
            variant="outline"
            size="sm"
            className="border-sand text-espresso"
            onClick={() => {
              setFrom('');
              setTo('');
              setPage(1);
            }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-sand/30 bg-pearl overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-sand/20 hover:bg-sand/20">
              <TableHead className="font-body text-xs font-semibold uppercase tracking-wider text-espresso/70">
                Date/Time
              </TableHead>
              <TableHead className="font-body text-xs font-semibold uppercase tracking-wider text-espresso/70">
                Variant (SKU)
              </TableHead>
              <TableHead className="font-body text-xs font-semibold uppercase tracking-wider text-espresso/70">
                Reason
              </TableHead>
              <TableHead className="font-body text-xs font-semibold uppercase tracking-wider text-espresso/70 text-right">
                Delta
              </TableHead>
              <TableHead className="font-body text-xs font-semibold uppercase tracking-wider text-espresso/70">
                Before → After
              </TableHead>
              <TableHead className="font-body text-xs font-semibold uppercase tracking-wider text-espresso/70">
                Actor
              </TableHead>
              <TableHead className="font-body text-xs font-semibold uppercase tracking-wider text-espresso/70">
                Note
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                </TableRow>
              ))
            ) : movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <div className="flex flex-col items-center">
                    <History className="mb-3 h-10 w-10 text-mist" />
                    <p className="font-body text-sm text-mist">No stock movements found</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              movements.map(
                (m: {
                  id: string;
                  createdAt: string;
                  variant: { sku: string };
                  reason: string;
                  quantityDelta: number;
                  quantityBefore: number;
                  quantityAfter: number;
                  actor: { email: string };
                  note: string | null;
                }) => (
                  <TableRow key={m.id} className="hover:bg-sand/10">
                    <TableCell className="font-body text-sm text-espresso whitespace-nowrap">
                      {formatDateTime(m.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-espresso">
                      {m.variant?.sku ?? '—'}
                    </TableCell>
                    <TableCell>
                      <ReasonBadge reason={m.reason} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      <span
                        className={
                          m.quantityDelta > 0
                            ? 'text-green-700'
                            : m.quantityDelta < 0
                              ? 'text-red-700'
                              : 'text-espresso'
                        }
                      >
                        {m.quantityDelta > 0 ? '+' : ''}
                        {m.quantityDelta}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-espresso whitespace-nowrap">
                      {m.quantityBefore} → {m.quantityAfter}
                    </TableCell>
                    <TableCell className="font-body text-sm text-espresso truncate max-w-[160px]">
                      {m.actor?.email ?? '—'}
                    </TableCell>
                    <TableCell className="font-body text-sm text-espresso max-w-[200px] truncate">
                      {m.note || '—'}
                    </TableCell>
                  </TableRow>
                ),
              )
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="font-body text-sm text-mist">
            Page {meta.page} of {meta.totalPages} · {meta.total} movements
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="border-sand text-espresso"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-sand text-espresso"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
