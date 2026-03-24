'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatRupee } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ReturnDetailModal } from '@/components/pos/ReturnDetailModal';
import { SaleDetailModal } from '@/components/pos/SaleDetailModal';
import { Check, Minus, AlertTriangle, Eye, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface ReturnLine {
  id: string;
  productNameSnapshot: string;
  variantDescriptionSnapshot: string;
  quantity: number;
  unitPrice: number | string;
  lineRefundAmount: number | string;
  isRestocked: boolean;
}

interface SaleData {
  id: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: 'CASH' | 'CARD' | 'SPLIT' | null;
  status: 'OPEN' | 'COMPLETED' | 'VOIDED';
  authorizingManagerId: string | null;
  createdAt: string;
  lines: Array<{
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
  }>;
}

interface ReturnRecord {
  id: string;
  refundAmount: number | string;
  refundMethod: 'CASH' | 'CARD_REVERSAL' | 'STORE_CREDIT' | 'EXCHANGE';
  restockItems: boolean;
  reason: string;
  status: string;
  createdAt: string;
  lines: ReturnLine[];
  originalSale: SaleData;
  initiatedBy: { id: string; name: string };
  authorizedBy: { id: string; name: string };
}

interface Filters {
  originalSaleId: string;
  refundMethod: string;
  from: string;
  to: string;
  page: number;
}

const refundMethodLabel: Record<string, string> = {
  CASH: 'Cash',
  CARD_REVERSAL: 'Card Reversal',
  STORE_CREDIT: 'Store Credit',
  EXCHANGE: 'Exchange',
};

const refundMethodBadgeClass: Record<string, string> = {
  CASH: 'bg-green-100 text-green-800 border-green-200',
  CARD_REVERSAL: 'bg-blue-100 text-blue-800 border-blue-200',
  STORE_CREDIT: 'bg-mist/30 text-espresso border-mist',
  EXCHANGE: 'bg-terracotta text-white border-terracotta',
};

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }) +
    ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  );
}

export function ReturnsHistoryTable() {
  const [filters, setFilters] = useState<Filters>({
    originalSaleId: '',
    refundMethod: '',
    from: '',
    to: '',
    page: 1,
  });
  const [debouncedSaleId, setDebouncedSaleId] = useState('');
  const [selectedReturn, setSelectedReturn] = useState<ReturnRecord | null>(null);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleData | null>(null);
  const [saleModalOpen, setSaleModalOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSaleId(filters.originalSaleId);
      setFilters((prev) => ({ ...prev, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.originalSaleId]);

  const buildParams = useCallback(() => {
    const params = new URLSearchParams();
    if (debouncedSaleId) params.set('originalSaleId', debouncedSaleId);
    if (filters.refundMethod) params.set('refundMethod', filters.refundMethod);
    if (filters.from) params.set('from', new Date(filters.from).toISOString());
    if (filters.to) {
      const toDate = new Date(filters.to);
      toDate.setHours(23, 59, 59, 999);
      params.set('to', toDate.toISOString());
    }
    params.set('page', String(filters.page));
    params.set('limit', '25');
    return params.toString();
  }, [debouncedSaleId, filters.refundMethod, filters.from, filters.to, filters.page]);

  const { data, isLoading } = useQuery<{
    success: boolean;
    data: ReturnRecord[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }>({
    queryKey: ['returns', debouncedSaleId, filters.refundMethod, filters.from, filters.to, filters.page],
    queryFn: async () => {
      const res = await fetch(`/api/store/returns?${buildParams()}`);
      if (!res.ok) throw new Error('Failed to fetch returns');
      return res.json();
    },
    staleTime: 30_000,
  });

  const returns = data?.data ?? [];
  const pagination = data?.pagination;
  const hasFilters = filters.originalSaleId || filters.refundMethod || filters.from || filters.to;

  const clearFilters = () => {
    setFilters({ originalSaleId: '', refundMethod: '', from: '', to: '', page: 1 });
    setDebouncedSaleId('');
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="font-body text-xs text-mist">From</label>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value, page: 1 }))}
            className="h-9 rounded-md border border-mist/50 bg-white px-3 font-body text-sm text-espresso focus:outline-none focus:ring-1 focus:ring-terracotta"
          />
        </div>
        <div className="space-y-1">
          <label className="font-body text-xs text-mist">To</label>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value, page: 1 }))}
            className="h-9 rounded-md border border-mist/50 bg-white px-3 font-body text-sm text-espresso focus:outline-none focus:ring-1 focus:ring-terracotta"
          />
        </div>
        <div className="space-y-1">
          <label className="font-body text-xs text-mist">Refund Method</label>
          <Select
            value={filters.refundMethod}
            onValueChange={(value) =>
              setFilters((prev) => ({ ...prev, refundMethod: value === 'ALL' ? '' : value, page: 1 }))
            }
          >
            <SelectTrigger className="h-9 w-40 font-body text-sm">
              <SelectValue placeholder="All Methods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Methods</SelectItem>
              <SelectItem value="CASH">Cash</SelectItem>
              <SelectItem value="CARD_REVERSAL">Card Reversal</SelectItem>
              <SelectItem value="STORE_CREDIT">Store Credit</SelectItem>
              <SelectItem value="EXCHANGE">Exchange</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="font-body text-xs text-mist">Sale ID</label>
          <Input
            placeholder="Search by sale ID…"
            value={filters.originalSaleId}
            onChange={(e) => setFilters((prev) => ({ ...prev, originalSaleId: e.target.value }))}
            className="h-9 w-50 font-body text-sm"
          />
        </div>
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={clearFilters} className="h-9">
            <X className="mr-1 h-3.5 w-3.5" />
            Clear Filters
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded bg-linen" />
          ))}
        </div>
      ) : returns.length === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-2 py-16">
          <p className="font-body text-sm text-mist">No returns found</p>
          {hasFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-mist/30">
          <Table>
            <TableHeader>
              <TableRow className="bg-linen">
                <TableHead className="font-body text-xs text-mist">Return Ref</TableHead>
                <TableHead className="font-body text-xs text-mist">Original Sale</TableHead>
                <TableHead className="font-body text-xs text-mist">Date</TableHead>
                <TableHead className="text-center font-body text-xs text-mist">Items</TableHead>
                <TableHead className="text-right font-body text-xs text-mist">Refund</TableHead>
                <TableHead className="font-body text-xs text-mist">Method</TableHead>
                <TableHead className="text-center font-body text-xs text-mist">Restocked</TableHead>
                <TableHead className="font-body text-xs text-mist">Authorized By</TableHead>
                <TableHead className="text-center font-body text-xs text-mist">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.map((returnRecord) => {
                const totalQty = returnRecord.lines.reduce((sum, line) => sum + line.quantity, 0);
                const allRestocked = returnRecord.lines.every((line) => line.isRestocked);
                const someRestocked = returnRecord.lines.some((line) => line.isRestocked);

                return (
                  <TableRow key={returnRecord.id}>
                    <TableCell className="font-mono text-xs text-espresso">
                      {returnRecord.id.slice(0, 8).toUpperCase()}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="font-mono text-xs text-terracotta hover:underline"
                        onClick={() => {
                          setSelectedSale(returnRecord.originalSale);
                          setSaleModalOpen(true);
                        }}
                      >
                        {returnRecord.originalSale.id.slice(0, 8).toUpperCase()}
                      </button>
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-body text-xs text-espresso">
                      {formatDateTime(returnRecord.createdAt)}
                    </TableCell>
                    <TableCell className="text-center font-body text-xs text-espresso">
                      {totalQty}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-espresso">
                      {formatRupee(returnRecord.refundAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${refundMethodBadgeClass[returnRecord.refundMethod] ?? ''}`}
                      >
                        {refundMethodLabel[returnRecord.refundMethod] ?? returnRecord.refundMethod}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {allRestocked ? (
                        <Check className="mx-auto h-4 w-4 text-green-600" />
                      ) : someRestocked ? (
                        <AlertTriangle className="mx-auto h-4 w-4 text-yellow-500" />
                      ) : (
                        <Minus className="mx-auto h-4 w-4 text-mist" />
                      )}
                    </TableCell>
                    <TableCell className="font-body text-xs text-espresso">
                      {returnRecord.authorizedBy.name}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => {
                          setSelectedReturn(returnRecord);
                          setReturnModalOpen(true);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="font-body text-xs text-mist">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <ReturnDetailModal
        returnData={selectedReturn}
        open={returnModalOpen}
        onOpenChange={setReturnModalOpen}
      />

      <SaleDetailModal
        sale={selectedSale}
        open={saleModalOpen}
        onOpenChange={setSaleModalOpen}
      />
    </div>
  );
}