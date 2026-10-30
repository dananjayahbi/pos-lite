'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  CreditCard,
  Loader2,
  PackageCheck,
  Pencil,
  Send,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRupee } from '@/lib/format';

import { cancelPurchaseOrder, recordPurchaseOrderPayment } from './poApi';
import { formatPoDate } from './poDates';
import { poQueryKeys } from './poQueryKeys';
import type { PurchaseOrderDetail, RecordPaymentPayload } from './poTypes';
import { POEditDialog } from './POEditDialog';
import { POHeaderCards } from './POHeaderCards';
import { POLinesTable } from './POLinesTable';
import { POPaymentHistory } from './POPaymentHistory';
import { POStatusBadge } from './POStatusBadge';
import { PORecordPaymentDialog } from './PORecordPaymentDialog';
import { POTotalsCard } from './POTotalsCard';
import { usePOPayments } from './usePOPayments';

/**
 * Purchase-order detail: header actions, financial summary, lines and payments.
 *
 * Every mutation invalidates both the singular detail key (shared with the
 * receiving page) and the list key, so a settle or cancel updates both views.
 */

const PAYABLE_STATUSES = new Set(['DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED']);

export function PurchaseOrderDetailClient({ poId }: { poId: string }) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [cancelOpen, setCancelOpen] = useState(false);
  // `?edit=1` lets the list's Edit action land here with the sheet already open,
  // instead of duplicating the whole edit form on the list page.
  const [editOpen, setEditOpen] = useState(searchParams.get('edit') === '1');
  const [cancelling, setCancelling] = useState(false);
  const [markingSent, setMarkingSent] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const { data, isLoading } = useQuery<{ success: boolean; data: PurchaseOrderDetail }>({
    queryKey: poQueryKeys.detail(poId),
    queryFn: () => fetch(`/api/store/purchase-orders/${poId}`).then((r) => r.json()),
  });

  const po = data?.data;
  const payable = po ? Number(po.totalAmount) : 0;
  const paymentsState = usePOPayments(poId, payable);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: poQueryKeys.detail(poId) });
    queryClient.invalidateQueries({ queryKey: poQueryKeys.all });
    queryClient.invalidateQueries({ queryKey: poQueryKeys.payments(poId) });
    queryClient.invalidateQueries({ queryKey: poQueryKeys.paymentAccounts() });
  }, [poId, queryClient]);

  const handleMarkSent = useCallback(async () => {
    setMarkingSent(true);
    try {
      const res = await fetch(`/api/store/purchase-orders/${poId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'SENT' }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error?.message ?? 'Failed to update status');
        return;
      }
      toast.success('Purchase order marked as Sent');
      invalidate();
    } catch {
      toast.error('Network error');
    } finally {
      setMarkingSent(false);
    }
  }, [poId, invalidate]);

  const handleCancel = useCallback(async () => {
    setCancelling(true);
    try {
      await cancelPurchaseOrder(poId);
      toast.success('Purchase order cancelled');
      setCancelOpen(false);
      invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  }, [poId, invalidate]);

  const handleRecordPayment = useCallback(
    async (payload: RecordPaymentPayload) => {
      const result = await recordPurchaseOrderPayment(poId, payload);
      toast.success(
        result.settled
          ? 'Payment recorded — PO settled in full'
          : `Payment of ${formatRupee(result.amount)} recorded`,
      );
      setPayOpen(false);
      invalidate();
    },
    [poId, invalidate],
  );

  if (isLoading) {
    return (
      <div className="space-y-6 p-6 md:p-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!po) {
    return (
      <div className="space-y-4 p-6 md:p-8">
        <p className="text-mist">Purchase order not found.</p>
        <Button variant="outline" asChild>
          <Link href="/suppliers/purchase-orders">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Purchase Orders
          </Link>
        </Button>
      </div>
    );
  }

  const status = po.status;
  const canCancel = status === 'DRAFT' || status === 'SENT' || status === 'PARTIALLY_RECEIVED';
  const canPay = PAYABLE_STATUSES.has(status) && paymentsState.outstanding > 0;

  return (
    <div className="space-y-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/suppliers/purchase-orders"
            className="mb-2 inline-flex items-center gap-1 text-sm text-mist hover:text-terracotta"
          >
            <ArrowLeft className="h-3 w-3" /> Purchase Orders
          </Link>
          <h1 className="font-mono text-2xl font-semibold text-espresso">{po.referenceNo}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <POStatusBadge status={status} />
            <span className="text-sm text-mist">Ordered {formatPoDate(po.orderDate)}</span>
            {po.paidAt ? (
              <span className="inline-flex items-center gap-1 text-sm text-green-700">
                <Check className="h-3 w-3" /> Paid in full
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {status !== 'CANCELLED' ? (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          ) : null}
          {canPay ? (
            <Button onClick={() => setPayOpen(true)}>
              <CreditCard className="mr-2 h-4 w-4" />
              Record Payment
            </Button>
          ) : null}
          {status === 'DRAFT' ? (
            <>
              <Button variant="outline" onClick={handleMarkSent} disabled={markingSent}>
                {markingSent ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Mark as Sent
              </Button>
            </>
          ) : null}
          {status === 'SENT' || status === 'PARTIALLY_RECEIVED' ? (
            <Button variant="outline" asChild>
              <Link href={`/suppliers/purchase-orders/${poId}/receive`}>
                <PackageCheck className="mr-2 h-4 w-4" />
                Receive Goods
              </Link>
            </Button>
          ) : null}
          {canCancel ? (
            <Button
              variant="destructive"
              onClick={() => setCancelOpen(true)}
              disabled={cancelling}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancel PO
            </Button>
          ) : null}
          {status === 'RECEIVED' ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-3 py-1.5 text-sm text-green-700">
              <Check className="h-4 w-4" />
              All goods received
            </span>
          ) : null}
          {status === 'CANCELLED' ? (
            <span className="rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-700">Cancelled</span>
          ) : null}
        </div>
      </div>

      {/* Info cards */}
      <POHeaderCards
        supplierName={po.supplier.name}
        supplierContact={po.supplier.contactName}
        expectedDeliveryDate={po.expectedDeliveryDate}
        paymentTermDays={po.paymentTermDays}
        orderDate={po.orderDate}
        createdAt={po.createdAt}
        createdByEmail={po.createdBy.email}
      />

      {/* Totals */}
      <POTotalsCard
        subtotal={po.subtotalAmount}
        discountType={po.discountType}
        discountValue={po.discountValue}
        discountAmount={po.discountAmount}
        total={po.totalAmount}
      />

      {po.notes ? (
        <Card>
          <CardContent className="pt-6">
            <p className="mb-1 text-xs text-mist">Notes</p>
            <p className="whitespace-pre-wrap text-sm text-espresso">{po.notes}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* Lines */}
      <POLinesTable lines={po.lines} />

      <POPaymentHistory
        payments={paymentsState.payments}
        payable={paymentsState.payable}
        paidTotal={paymentsState.paidTotal}
        outstanding={paymentsState.outstanding}
        settled={paymentsState.settled}
        isLoading={paymentsState.isLoading}
      />

      <PORecordPaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        referenceNo={po.referenceNo}
        outstanding={paymentsState.outstanding}
        defaultAccountId={po.paymentAccountId}
        onSubmit={handleRecordPayment}
      />

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Purchase Order?</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel {po.referenceNo}? This action cannot be undone.
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

      {editOpen ? (
        <POEditDialog open={editOpen} onOpenChange={setEditOpen} purchaseOrder={po} />
      ) : null}
    </div>
  );
}
