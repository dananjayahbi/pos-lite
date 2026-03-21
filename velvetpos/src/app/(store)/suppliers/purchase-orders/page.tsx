'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatRupee } from '@/lib/format';

// ── Types ────────────────────────────────────────────────────────────────────

interface PurchaseOrder {
  id: string;
  supplierId: string;
  supplier: { name: string };
  status: string;
  totalAmount: string | number;
  expectedDeliveryDate?: string | null;
  createdAt: string;
  _count: { lines: number };
}

interface POsResponse {
  purchaseOrders: PurchaseOrder[];
  total: number;
  page: number;
  totalPages: number;
}

interface SupplierOption {
  id: string;
  name: string;
}

// ── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SENT: 'bg-blue-50 text-blue-700',
  PARTIALLY_RECEIVED: 'bg-amber-50 text-amber-700',
  RECEIVED: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-red-50 text-red-700 line-through',
};

const STATUS_OPTIONS = ['ALL', 'DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'];

function formatPORef(id: string) {
  return `PO-${id.slice(-8).toUpperCase()}`;
}

function formatDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PurchaseOrdersPage() {
  const [supplierId, setSupplierId] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [supplierId, status, from, to]);

  // Fetch suppliers for dropdown
  const { data: suppliersData } = useQuery<{ success: boolean; data: { suppliers: SupplierOption[] } }>({
    queryKey: ['suppliers-dropdown'],
    queryFn: () =>
      fetch('/api/store/suppliers?limit=100').then((r) => r.json()),
  });
  const suppliers = suppliersData?.data?.suppliers ?? [];

  // Build query params
  const queryParams = new URLSearchParams();
  if (supplierId !== 'ALL') queryParams.set('supplierId', supplierId);
  if (status !== 'ALL') queryParams.set('status', status);
  if (from) queryParams.set('from', from);
  if (to) queryParams.set('to', to);
  queryParams.set('page', String(page));
  queryParams.set('limit', '20');

  const { data, isLoading } = useQuery<{ success: boolean; data: POsResponse }>({
    queryKey: ['purchase-orders', supplierId, status, from, to, page],
    queryFn: () =>
      fetch(`/api/store/purchase-orders?${queryParams.toString()}`).then((r) => r.json()),
  });

  const pos = data?.data?.purchaseOrders ?? [];
  const totalPages = data?.data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-espresso">Purchase Orders</h1>
        <Link href="/suppliers/purchase-orders/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Purchase Order
          </Button>
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3">
        <Select value={supplierId} onValueChange={setSupplierId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Suppliers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Suppliers</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s === 'ALL' ? 'All Statuses' : s.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="w-[160px]"
          placeholder="From"
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="w-[160px]"
          placeholder="To"
        />
      </div>

      {/* Table */}
      <div className="rounded-md border border-mist">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>PO Reference</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Lines</TableHead>
              <TableHead className="text-right">Total Amount</TableHead>
              <TableHead>Expected Delivery</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : pos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
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
                      {formatPORef(po.id)}
                    </Link>
                  </TableCell>
                  <TableCell>{po.supplier.name}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_STYLES[po.status] ?? ''} variant="secondary">
                      {po.status.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{po._count.lines}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatRupee(po.totalAmount)}
                  </TableCell>
                  <TableCell>
                    {po.expectedDeliveryDate
                      ? formatDate(po.expectedDeliveryDate)
                      : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(po.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/suppliers/purchase-orders/${po.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
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
