'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  MoreHorizontal,
  PackageCheck,
  Pencil,
  Plus,
  Send,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { formatRupee } from '@/lib/format';

import { cancelPurchaseOrder } from './poApi';
import { formatPoDate } from './poDates';
import { POStatusBadge } from './POStatusBadge';
import { poQueryKeys } from './poQueryKeys';
import type { PurchaseOrderListResponse, PurchaseOrderListItem } from './poTypes';

/** Every status the API can return, plus the "any" sentinel for the filter. */
const STATUS_OPTIONS = [
  'ALL',
  'DRAFT',
  'SENT',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'CANCELLED',
] as const;

interface SupplierOption {
  id: string;
  name: string;
}

export function PurchaseOrdersListClient() {
  const queryClient = useQueryClient();

  const [supplierId, setSupplierId] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);

  const [cancelTarget, setCancelTarget] = useState<PurchaseOrderListItem | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Filter setters reset pagination together with the filter, so page 4 of a
  // previous result set can never hide the new matches.
  const changeSupplier = useCallback((next: string) => {
    setSupplierId(next);
    setPage(1);
  }, []);

  const changeStatus = useCallback((next: string) => {
    setStatus(next);
    setPage(1);
  }, []);

  const changeFromDate = useCallback((next: string) => {
    setFromDate(next);
    setPage(1);
  }, []);

  const changeToDate = useCallback((next: string) => {
    setToDate(next);
    setPage(1);
  }, []);

  const { data: suppliersData } = useQuery<{
    success: boolean;
    data: { suppliers: SupplierOption[] };
  }>({
    queryKey: poQueryKeys.supplierOptions(),
    queryFn: () => fetch('/api/store/suppliers?limit=100').then((r) => r.json()),
    staleTime: 60_000,
  });
  const suppliers = suppliersData?.data?.suppliers ?? [];

  const { data, isLoading } = useQuery<{ success: boolean; data: PurchaseOrderListResponse }>({
    queryKey: poQueryKeys.list({ supplierId, status, from: fromDate, to: toDate, page }),
    queryFn: () => {
      const params = new URLSearchParams();
      if (supplierId !== 'ALL') params.set('supplierId', supplierId);
      if (status !== 'ALL') params.set('status', status);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      params.set('page', String(page));
      params.set('limit', '20');
      return fetch(`/api/store/purchase-orders?${params.toString()}`).then((r) => r.json());
    },
  });

  const pos = data?.data?.purchaseOrders ?? [];
  const totalPages = data?.data?.totalPages ?? 1;

  const invalidate = useCallback(
    async (poId?: string) => {
      await queryClient.invalidateQueries({ queryKey: poQueryKeys.all });
      if (poId) {
        await queryClient.invalidateQueries({ queryKey: poQueryKeys.detail(poId) });
      }
    },
    [queryClient],
  );

  const handleCancel = useCallback(async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelPurchaseOrder(cancelTarget.id);
      toast.success(`${cancelTarget.referenceNo} cancelled`);
      setCancelTarget(null);
      await invalidate(cancelTarget.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  }, [cancelTarget, invalidate]);

  const handleMarkSent = useCallback(
    async (po: PurchaseOrderListItem) => {
      try {
        const res = await fetch(`/api/store/purchase-orders/${po.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'SENT' }),
        });
        const json = await res.json();
        if (!json.success) {
          toast.error(json.error?.message ?? 'Failed to update status');
          return;
        }
        toast.success(`${po.referenceNo} marked as Sent`);
        await invalidate(po.id);
      } catch {
        toast.error('Network error');
      }
    },
    [invalidate],
  );

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-espresso">Purchase Orders</h1>
          <p className="mt-1 text-sm text-sand">
            Track what was ordered, what it costs, and what is still owed.
          </p>
        </div>
        <Button asChild>
          <Link href="/suppliers/purchase-orders/new">
            <Plus className="mr-2 h-4 w-4" />
            New Purchase Order
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={supplierId} onValueChange={changeSupplier}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Suppliers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Suppliers</SelectItem>
            {suppliers.map((supplier) => (
              <SelectItem key={supplier.id} value={supplier.id}>
                {supplier.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={changeStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option === 'ALL' ? 'All Statuses' : option.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={fromDate}
          onChange={(event) => changeFromDate(event.target.value)}
          className="w-[160px]"
          aria-label="Created from"
        />
        <Input
          type="date"
          value={toDate}
          onChange={(event) => changeToDate(event.target.value)}
          className="w-[160px]"
          aria-label="Created to"
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-sand/30 bg-pearl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO Reference</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-center">Lines</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Order Date</TableHead>
              <TableHead>Expected Delivery</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, rowIndex) => (
                <TableRow key={rowIndex}>
                  {Array.from({ length: 9 }).map((__, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : pos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-mist">
                  No purchase orders found
                </TableCell>
              </TableRow>
            ) : (
              pos.map((po) => (
                <TableRow key={po.id}>
                  <TableCell>
                    <Link
                      href={`/suppliers/purchase-orders/${po.id}`}
                      className="font-mono text-sm text-terracotta hover:underline"
                    >
                      {po.referenceNo}
                    </Link>
                  </TableCell>
                  <TableCell>{po.supplier.name}</TableCell>
                  <TableCell>
                    <POStatusBadge status={po.status} />
                  </TableCell>
                  <TableCell>
                    {po.paidAt ? (
                      <Badge className="bg-green-50 text-green-700" variant="secondary">
                        Paid
                      </Badge>
                    ) : (
                      <span className="text-xs text-mist">Unpaid</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{po._count.lines}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatRupee(po.totalAmount)}
                    {Number(po.discountAmount) > 0 ? (
                      <span className="ml-1 block text-[10px] font-normal text-mist line-through">
                        {formatRupee(po.subtotalAmount)}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-mist">{formatPoDate(po.orderDate)}</TableCell>
                  <TableCell className="text-mist">
                    {po.expectedDeliveryDate ? formatPoDate(po.expectedDeliveryDate) : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" aria-label="Row actions">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="border-sand/30 bg-pearl">
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/suppliers/purchase-orders/${po.id}`}
                            className="flex cursor-pointer items-center gap-2"
                          >
                            <Eye className="h-4 w-4" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        {po.status !== 'CANCELLED' ? (
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/suppliers/purchase-orders/${po.id}?edit=1`}
                              className="flex cursor-pointer items-center gap-2"
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                        ) : null}
                        {po.status === 'DRAFT' ? (
                          <DropdownMenuItem
                            className="flex cursor-pointer items-center gap-2"
                            onClick={() => void handleMarkSent(po)}
                          >
                            <Send className="h-4 w-4" />
                            Mark as Sent
                          </DropdownMenuItem>
                        ) : null}
                        {po.status === 'SENT' || po.status === 'PARTIALLY_RECEIVED' ? (
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/suppliers/purchase-orders/${po.id}/receive`}
                              className="flex cursor-pointer items-center gap-2"
                            >
                              <PackageCheck className="h-4 w-4" />
                              Receive Goods
                            </Link>
                          </DropdownMenuItem>
                        ) : null}
                        {po.status === 'DRAFT' ||
                        po.status === 'SENT' ||
                        po.status === 'PARTIALLY_RECEIVED' ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="flex cursor-pointer items-center gap-2 text-red-600 focus:text-red-600"
                              onClick={() => setCancelTarget(po)}
                            >
                              <XCircle className="h-4 w-4" />
                              Cancel PO
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-mist">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((current) => current - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Purchase Order?</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel {cancelTarget?.referenceNo ?? ''}? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelTarget(null)}
              disabled={cancelling}
            >
              Keep
            </Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? 'Cancelling…' : 'Cancel PO'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
