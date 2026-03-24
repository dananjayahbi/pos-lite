'use client';

import { useState, useCallback, use } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  MessageCircle,
  XCircle,
  PackageCheck,
  Check,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatRupee } from '@/lib/format';
import type { PurchaseOrderDetail } from '@/components/suppliers/GoodsReceivingForm';

// ── Types ────────────────────────────────────────────────────────────────────

// ── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SENT: 'bg-blue-50 text-blue-700',
  PARTIALLY_RECEIVED: 'bg-amber-50 text-amber-700',
  RECEIVED: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-red-50 text-red-700 line-through',
};

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

export default function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ poId: string }>;
}) {
  const { poId } = use(params);
  const queryClient = useQueryClient();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

  const { data, isLoading } = useQuery<{ success: boolean; data: PurchaseOrderDetail }>({
    queryKey: ['purchase-order', poId],
    queryFn: () =>
      fetch(`/api/store/purchase-orders/${poId}`).then((r) => r.json()),
  });

  const po = data?.data;

  const handleSendWhatsApp = useCallback(async () => {
    setSendingWhatsApp(true);
    try {
      const res = await fetch(`/api/store/purchase-orders/${poId}/send-whatsapp`, {
        method: 'POST',
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? 'Failed to send');
      } else {
        toast.success(`Purchase Order sent to ${po?.supplier.name ?? 'supplier'} via WhatsApp`);
        queryClient.invalidateQueries({ queryKey: ['purchase-order', poId] });
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSendingWhatsApp(false);
    }
  }, [poId, po?.supplier.name, queryClient]);

  const handleCancel = useCallback(async () => {
    setCancelling(true);
    try {
      const res = await fetch(`/api/store/purchase-orders/${poId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? 'Failed to cancel');
        return;
      }
      toast.success('Purchase order cancelled');
      setCancelOpen(false);
      queryClient.invalidateQueries({ queryKey: ['purchase-order', poId] });
    } catch {
      toast.error('Network error');
    } finally {
      setCancelling(false);
    }
  }, [poId, queryClient]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!po) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">Purchase order not found.</p>
        <Link href="/suppliers/purchase-orders">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Purchase Orders
          </Button>
        </Link>
      </div>
    );
  }

  const status = po.status;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link
            href="/suppliers/purchase-orders"
            className="text-sm text-muted-foreground hover:text-terracotta inline-flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="h-3 w-3" /> Purchase Orders
          </Link>
          <h1 className="font-mono text-2xl font-semibold text-espresso">
            {formatPORef(po.id)}
          </h1>
          <Badge className={`mt-2 ${STATUS_STYLES[status] ?? ''}`} variant="secondary">
            {status.replace(/_/g, ' ')}
          </Badge>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {status === 'DRAFT' && (
            <>
              <Button
                variant="outline"
                onClick={handleSendWhatsApp}
                disabled={sendingWhatsApp}
              >
                {sendingWhatsApp ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MessageCircle className="mr-2 h-4 w-4" />
                )}
                Send via WhatsApp
              </Button>
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700"
                onClick={() => setCancelOpen(true)}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancel PO
              </Button>
            </>
          )}
          {(status === 'SENT' || status === 'PARTIALLY_RECEIVED') && (
            <>
              <Button asChild>
                <Link href={`/suppliers/purchase-orders/${poId}/receive`}>
                  <PackageCheck className="mr-2 h-4 w-4" />
                  Receive Goods
                </Link>
              </Button>
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700"
                onClick={() => setCancelOpen(true)}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancel PO
              </Button>
            </>
          )}
          {status === 'RECEIVED' && (
            <Badge className="bg-green-50 text-green-700 text-sm py-1 px-3">
              <Check className="mr-1 h-4 w-4" />
              All goods received
            </Badge>
          )}
          {status === 'CANCELLED' && (
            <Badge className="bg-red-50 text-red-700 text-sm py-1 px-3">
              Cancelled
            </Badge>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Supplier</p>
            <p className="font-medium text-espresso">{po.supplier.name}</p>
            {po.supplier.contactName && (
              <p className="text-sm text-muted-foreground">{po.supplier.contactName}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Expected Delivery</p>
            <p className="font-medium text-espresso">
              {po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : 'Not specified'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Total Amount</p>
            <p className="font-mono font-medium text-espresso">{formatRupee(po.totalAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Created By</p>
            <p className="font-medium text-espresso">{po.createdBy.email}</p>
            <p className="text-xs text-muted-foreground">{formatDate(po.createdAt)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {po.notes && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground mb-1">Notes</p>
            <p className="text-sm text-espresso whitespace-pre-wrap">{po.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Lines Table */}
      <Card>
        <CardHeader>
          <CardTitle>Order Lines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-mist">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-center">Ordered</TableHead>
                  <TableHead className="text-center">Received</TableHead>
                  <TableHead className="text-center">Full</TableHead>
                  <TableHead className="text-right">Expected Cost</TableHead>
                  <TableHead className="text-right">Actual Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <p className="font-medium text-espresso">{line.productNameSnapshot}</p>
                      <p className="text-xs text-muted-foreground">
                        {line.variantDescriptionSnapshot}
                      </p>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{line.variant.sku}</TableCell>
                    <TableCell className="text-center">{line.orderedQty}</TableCell>
                    <TableCell className="text-center">
                      <span className={line.receivedQty > 0 ? 'text-green-600' : ''}>
                        {line.receivedQty} / {line.orderedQty}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {line.isFullyReceived ? (
                        <Check className="inline h-4 w-4 text-green-600" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatRupee(line.expectedCostPrice)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {line.actualCostPrice != null
                        ? formatRupee(line.actualCostPrice)
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Cancel Confirm Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Purchase Order?</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel {formatPORef(po.id)}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={cancelling}>
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
