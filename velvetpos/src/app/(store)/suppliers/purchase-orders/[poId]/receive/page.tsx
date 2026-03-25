'use client';

import { use, useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, PackageCheck } from 'lucide-react';
import { formatRupee } from '@/lib/format';
import { GoodsReceivingForm, type PurchaseOrderDetail } from '@/components/suppliers/GoodsReceivingForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-sand/30 text-espresso',
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

export default function PurchaseOrderReceivePage({
  params,
}: {
  params: Promise<{ poId: string }>;
}) {
  const { poId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [receiptResult, setReceiptResult] = useState<{
    costPricesChanged: Array<{
      variantId: string;
      oldCostPrice: string;
      newCostPrice: string;
    }>;
    costPriceChangedCount: number;
  } | null>(null);

  const { data, isLoading } = useQuery<{ success: boolean; data: PurchaseOrderDetail }>({
    queryKey: ['purchase-order', poId],
    queryFn: () => fetch(`/api/store/purchase-orders/${poId}`).then((res) => res.json()),
  });

  const po = data?.data;
  const canReceive = useMemo(
    () => po?.status === 'SENT' || po?.status === 'PARTIALLY_RECEIVED',
    [po?.status],
  );

  const handleSuccess = useCallback(
    (result: {
      costPricesChanged: Array<{
        variantId: string;
        oldCostPrice: string;
        newCostPrice: string;
      }>;
      costPriceChangedCount: number;
    }) => {
      setReceiptResult(result);
      queryClient.invalidateQueries({ queryKey: ['purchase-order', poId] });
    },
    [poId, queryClient],
  );

  if (isLoading) {
    return (
      <div className="space-y-6 p-6 md:p-8">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-96 w-full" />
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

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href={`/suppliers/purchase-orders/${poId}`}
            className="inline-flex items-center gap-1 text-sm text-mist hover:text-terracotta"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to {formatPORef(po.id)}
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-semibold text-espresso">Receive Goods</h1>
            <Badge className={STATUS_STYLES[po.status] ?? ''} variant="secondary">
              {po.status.replace(/_/g, ' ')}
            </Badge>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-sand">
            Review quantities against the supplier delivery, capture any invoice cost differences,
            and post the receipt without squeezing a warehouse workflow into a modal coffin.
          </p>
        </div>

        <Button variant="outline" asChild>
          <Link href={`/suppliers/purchase-orders/${poId}`}>
            <PackageCheck className="mr-2 h-4 w-4" />
            View PO Detail
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-mist">Supplier</p>
            <p className="font-medium text-espresso">{po.supplier.name}</p>
            {po.supplier.contactName ? (
              <p className="text-sm text-mist">{po.supplier.contactName}</p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-mist">Expected Delivery</p>
            <p className="font-medium text-espresso">
              {po.expectedDeliveryDate ? formatDate(po.expectedDeliveryDate) : 'Not specified'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-mist">Order Value</p>
            <p className="font-mono font-medium text-espresso">{formatRupee(po.totalAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-mist">Created</p>
            <p className="font-medium text-espresso">{formatDate(po.createdAt)}</p>
            <p className="text-xs text-mist">by {po.createdBy.email}</p>
          </CardContent>
        </Card>
      </div>

      {receiptResult ? (
        <Card className="border-green-200 bg-green-50/70">
          <CardContent className="flex flex-col gap-3 pt-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                <p className="font-medium">Receipt posted successfully</p>
              </div>
              <p className="text-sm text-green-800">
                {receiptResult.costPriceChangedCount > 0
                  ? `${receiptResult.costPriceChangedCount} variant cost price${receiptResult.costPriceChangedCount === 1 ? '' : 's'} were updated from the received invoice.`
                  : 'No cost price changes were needed for this receipt.'}
              </p>
              {receiptResult.costPricesChanged.length > 0 ? (
                <ul className="list-disc pl-5 text-sm text-green-900 space-y-1">
                  {receiptResult.costPricesChanged.map((change) => (
                    <li key={change.variantId}>
                      {change.variantId}: Rs. {change.oldCostPrice} → Rs. {change.newCostPrice}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <Button variant="outline" asChild>
              <Link href={`/suppliers/purchase-orders/${poId}`}>Return to PO detail</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Receiving Worksheet</CardTitle>
        </CardHeader>
        <CardContent>
          {canReceive ? (
            <GoodsReceivingForm
              po={po}
              onCancel={() => router.push(`/suppliers/purchase-orders/${poId}`)}
              cancelLabel="Back to PO"
              onSuccess={handleSuccess}
            />
          ) : (
            <div className="rounded-lg border border-mist/40 bg-linen p-6 text-sm text-mist">
              This purchase order is currently <strong>{po.status.replace(/_/g, ' ').toLowerCase()}</strong>, so no receiving action is available.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
