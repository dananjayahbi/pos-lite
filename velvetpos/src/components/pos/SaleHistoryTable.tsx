'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Ban, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { formatRupee } from '@/lib/format';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SaleDetailModal } from '@/components/pos/SaleDetailModal';
import { ReturnWizardSheet } from '@/components/pos/ReturnWizardSheet';

interface SaleLine {
  id: string;
  productNameSnapshot: string;
  variantDescriptionSnapshot: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  discountPercent: number;
  discountAmount: number;
  lineTotalBeforeDiscount: number;
  lineTotalAfterDiscount: number;
  returnedQuantity: number;
}

interface Sale {
  id: string;
  shiftId: string;
  cashierId: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: 'CASH' | 'CARD' | 'SPLIT' | null;
  status: 'OPEN' | 'COMPLETED' | 'VOIDED';
  authorizingManagerId: string | null;
  completedAt: string | null;
  createdAt: string;
  lines: SaleLine[];
}

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getShortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function PaymentBadge({ method }: { method: string | null }) {
  if (!method)
    return (
      <Badge variant="secondary" className="text-[10px]">
        —
      </Badge>
    );
  const colors: Record<string, string> = {
    CASH: 'bg-[#2D6A4F] text-white',
    CARD: 'bg-[#1D4E89] text-white',
    SPLIT: 'bg-terracotta text-white',
  };
  return (
    <Badge className={`text-[10px] ${colors[method] ?? ''}`}>{method}</Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    COMPLETED: { label: 'Completed', className: 'bg-[#2D6A4F] text-white' },
    VOIDED: { label: 'Voided', className: 'bg-[#9B2226] text-white' },
    OPEN: { label: 'Held', className: 'bg-[#B7791F] text-white' },
  };
  const info = map[status];
  if (!info) return null;
  return <Badge className={`text-[10px] ${info.className}`}>{info.label}</Badge>;
}

export function SaleHistoryTable() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const canVoid = hasPermission(PERMISSIONS.SALE.voidSale);

  // Filters
  const [status, setStatus] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [fromDate, setFromDate] = useState(getToday());
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Detail modal
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  // Return wizard
  const [returnSaleId, setReturnSaleId] = useState<string | null>(null);

  // Void dialog
  const [voidSaleTarget, setVoidSaleTarget] = useState<Sale | null>(null);
  const [voidLoading, setVoidLoading] = useState(false);

  // Fetch sales
  const { data, isLoading } = useQuery({
    queryKey: ['sale-history', status, fromDate, toDate, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (fromDate) params.set('from', new Date(fromDate).toISOString());
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        params.set('to', to.toISOString());
      }
      params.set('page', String(page));
      params.set('limit', String(limit));

      const res = await fetch(`/api/store/sales?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch sales');
      return res.json() as Promise<{
        success: boolean;
        data: Sale[];
        meta: { page: number; limit: number; total: number; totalPages: number };
      }>;
    },
  });

  const sales: Sale[] = data?.data ?? [];
  const meta = data?.meta ?? { page: 1, total: 0, totalPages: 1 };

  // Client-side payment method filter (API doesn't support it)
  const filteredSales = paymentMethod
    ? sales.filter((s) => s.paymentMethod === paymentMethod)
    : sales;

  const handleReset = () => {
    setStatus('');
    setPaymentMethod('');
    setFromDate(getToday());
    setToDate('');
    setPage(1);
  };

  const handleVoid = async () => {
    if (!voidSaleTarget) return;
    setVoidLoading(true);
    try {
      const res = await fetch(`/api/store/sales/${voidSaleTarget.id}/void`, {
        method: 'POST',
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        toast.error(json?.error?.message ?? 'Failed to void sale');
        return;
      }
      toast.success(
        `Sale ${getShortId(voidSaleTarget.id)} has been voided and stock restored`,
      );
      void queryClient.invalidateQueries({ queryKey: ['sale-history'] });
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setVoidLoading(false);
      setVoidSaleTarget(null);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-mist bg-white px-3 py-1.5 font-body text-sm text-espresso"
        >
          <option value="">All Status</option>
          <option value="COMPLETED">Completed</option>
          <option value="VOIDED">Voided</option>
          <option value="OPEN">Held</option>
        </select>
        <select
          value={paymentMethod}
          onChange={(e) => {
            setPaymentMethod(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-mist bg-white px-3 py-1.5 font-body text-sm text-espresso"
        >
          <option value="">All Payments</option>
          <option value="CASH">Cash</option>
          <option value="CARD">Card</option>
          <option value="SPLIT">Split</option>
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => {
            setFromDate(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-mist bg-white px-3 py-1.5 font-body text-sm text-espresso"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => {
            setToDate(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-mist bg-white px-3 py-1.5 font-body text-sm text-espresso"
        />
        <button
          type="button"
          onClick={handleReset}
          className="font-body text-xs text-terracotta hover:text-espresso transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded bg-linen" />
          ))}
        </div>
      ) : filteredSales.length === 0 ? (
        <p className="text-center text-mist font-body text-sm py-8">
          No sales found
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-body text-xs">Ref</TableHead>
              <TableHead className="font-body text-xs">Time</TableHead>
              <TableHead className="font-body text-xs text-center">
                Items
              </TableHead>
              <TableHead className="font-body text-xs text-right">
                Total
              </TableHead>
              <TableHead className="font-body text-xs">Payment</TableHead>
              <TableHead className="font-body text-xs">Status</TableHead>
              <TableHead className="font-body text-xs text-right">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSales.map((sale) => (
              <TableRow key={sale.id} className="hover:bg-linen/50">
                <TableCell>
                  <button
                    type="button"
                    onClick={() => setSelectedSaleId(sale.id)}
                    className="font-mono text-xs text-espresso hover:text-terracotta transition-colors"
                    title={sale.id}
                  >
                    {getShortId(sale.id)}
                  </button>
                </TableCell>
                <TableCell className="font-body text-xs text-espresso">
                  {formatTime(sale.createdAt)}
                </TableCell>
                <TableCell className="text-center">
                  <span className="inline-flex items-center justify-center bg-mist/30 text-espresso font-body text-xs px-2 py-0.5 rounded-full">
                    {sale.lines.length}
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-bold text-espresso">
                  {formatRupee(sale.totalAmount)}
                </TableCell>
                <TableCell>
                  <PaymentBadge method={sale.paymentMethod} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={sale.status} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedSaleId(sale.id)}
                      className="p-1 text-mist hover:text-espresso transition-colors"
                      aria-label="View sale"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {canVoid && sale.status === 'COMPLETED' && (
                      <button
                        type="button"
                        onClick={() => setVoidSaleTarget(sale)}
                        className="p-1 text-[#9B2226] hover:text-[#9B2226]/70 transition-colors"
                        aria-label="Void sale"
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                    )}
                    {sale.status === 'COMPLETED' && (() => {
                      const RETURN_WINDOW_DAYS = 30;
                      const saleDate = new Date(sale.createdAt);
                      const expiryDate = new Date(saleDate);
                      expiryDate.setDate(expiryDate.getDate() + RETURN_WINDOW_DAYS);
                      const returnWindowExpired = new Date() > expiryDate;
                      const fullyReturned = sale.lines.every(l => (l.returnedQuantity ?? 0) >= l.quantity);

                      if (returnWindowExpired) {
                        return (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button type="button" disabled className="p-1 text-mist/50 cursor-not-allowed" aria-label="Return window expired">
                                <RotateCcw className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-body text-xs">Sales older than 30 days cannot be returned</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      }
                      if (fullyReturned) {
                        return (
                          <button type="button" disabled className="p-1 text-mist/50 cursor-not-allowed" aria-label="Fully returned">
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        );
                      }
                      return (
                        <button type="button" onClick={() => setReturnSaleId(sale.id)} className="p-1 text-terracotta hover:text-espresso transition-colors" aria-label="Return items">
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      );
                    })()}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="font-body text-xs text-mist">
            Page {meta.page} of {meta.totalPages} ({meta.total} sales)
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Void confirmation dialog */}
      <Dialog
        open={voidSaleTarget !== null}
        onOpenChange={(open) => {
          if (!open) setVoidSaleTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              Void Sale {voidSaleTarget ? getShortId(voidSaleTarget.id) : ''}?
            </DialogTitle>
            <DialogDescription className="font-body text-sm">
              This will reverse the sale and restore stock for all line items.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setVoidSaleTarget(null)}
              disabled={voidLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleVoid}
              disabled={voidLoading}
              className="bg-[#9B2226] text-white hover:bg-[#9B2226]/90"
            >
              {voidLoading ? 'Voiding…' : 'Confirm Void'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sale detail modal */}
      <SaleDetailModal
        sale={filteredSales.find((s) => s.id === selectedSaleId) ?? null}
        open={selectedSaleId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedSaleId(null);
        }}
      />

      {/* Return wizard */}
      <ReturnWizardSheet
        saleId={returnSaleId}
        open={returnSaleId !== null}
        onOpenChange={(open) => {
          if (!open) setReturnSaleId(null);
        }}
        onReturnComplete={() => {
          setReturnSaleId(null);
          void queryClient.invalidateQueries({ queryKey: ['sale-history'] });
        }}
      />
    </div>
  );
}
