'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDelivery, useLabelTemplate } from '@/hooks/delivery';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { DEFAULT_LABEL_TEMPLATE } from '@/lib/constants/label';
import { StatusBadge } from '@/components/delivery/StatusBadge';
import { DeliveryDetailPanel } from '@/components/delivery/DeliveryDetailPanel';
import { DispatchSheet } from '@/components/delivery/DispatchSheet';
import { printShippingLabel } from '@/components/delivery/labels/ShippingLabel';
import { printOrderInvoice } from '@/components/delivery/invoices/printOrderInvoice';
import { waitForPrintOverlayToClose } from '@/lib/print-session';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface DeliveryDetailPageClientProps {
  deliveryId: string;
}

type PrintAction = 'waybill' | 'invoice';

export function DeliveryDetailPageClient({ deliveryId }: DeliveryDetailPageClientProps) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const { data: delivery, isLoading } = useDelivery(deliveryId);
  const { data: labelTemplate } = useLabelTemplate();
  const { hasPermission } = usePermissions();
  const canDispatch = hasPermission(PERMISSIONS.DELIVERY.dispatchDelivery);

  const [dispatchOpen, setDispatchOpen] = useState(false);
  /** Which print action is running, so its button can show a spinner. */
  const [printing, setPrinting] = useState<PrintAction | null>(null);

  const runPrint = async (action: PrintAction, task: () => Promise<void>) => {
    setPrinting(action);
    try {
      await task();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Printing failed');
    } finally {
      setPrinting(null);
    }
  };

  const handlePrintWaybill = () => {
    if (!delivery) return;
    void runPrint('waybill', async () => {
      printShippingLabel(delivery, labelTemplate ?? DEFAULT_LABEL_TEMPLATE);
      await waitForPrintOverlayToClose();
    });
  };

  const handlePrintInvoice = () => {
    if (!delivery) return;
    void runPrint('invoice', async () => {
      await printOrderInvoice(delivery.id);
      await waitForPrintOverlayToClose();
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => startTransition(() => router.push('/delivery'))}
            disabled={isNavigating}
            data-testid="delivery-back-button"
          >
            {isNavigating ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" data-testid="loading-spinner" />
            ) : (
              '←'
            )}{' '}
            Back
          </Button>
          <h1 className="truncate text-xl font-semibold text-espresso">
            {delivery ? delivery.orderRef : 'Delivery'}
          </h1>
          {delivery && <StatusBadge status={delivery.status} />}
        </div>

        {delivery && (
          // All header actions share one tight flex row — previously each button
          // was a direct child of `justify-between`, which spread them across
          // the whole header (Issue #23, point 03).
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={handlePrintWaybill}
              disabled={printing !== null}
              aria-busy={printing === 'waybill'}
              data-testid="delivery-waybill-button"
            >
              {printing === 'waybill' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" data-testid="loading-spinner" />
              ) : null}
              {printing === 'waybill' ? 'Preparing waybill…' : 'Waybill'}
            </Button>
            <Button
              variant="outline"
              onClick={handlePrintInvoice}
              disabled={printing !== null}
              aria-busy={printing === 'invoice'}
              data-testid="delivery-invoice-button"
            >
              {printing === 'invoice' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" data-testid="loading-spinner" />
              ) : null}
              {printing === 'invoice' ? 'Preparing invoice…' : 'Print Invoice'}
            </Button>
            {canDispatch && delivery.status === 'PENDING_DISPATCH' && (
              <Button onClick={() => setDispatchOpen(true)} data-testid="delivery-dispatch-button">
                Dispatch
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {/* Not found */}
      {!isLoading && !delivery && (
        <div className="rounded-lg border border-espresso/10 py-16 text-center text-espresso/60">
          Delivery not found.
        </div>
      )}

      {/* Content */}
      {!isLoading && delivery && <DeliveryDetailPanel delivery={delivery} />}

      <DispatchSheet
        delivery={delivery ?? null}
        open={dispatchOpen}
        onClose={() => setDispatchOpen(false)}
      />
    </div>
  );
}
