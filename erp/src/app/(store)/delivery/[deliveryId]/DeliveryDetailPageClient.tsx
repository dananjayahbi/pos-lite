'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDelivery, useLabelTemplate } from '@/hooks/delivery';
import { useBulkCreateDelivery } from '@/hooks/orders';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { StatusBadge } from '@/components/delivery/StatusBadge';
import { DeliveryDetailPanel } from '@/components/delivery/DeliveryDetailPanel';
import { DispatchSheet } from '@/components/delivery/DispatchSheet';
import { canPrepareDelivery } from '@/components/delivery/prepareDelivery';
import { printShippingLabel } from '@/components/delivery/labels/ShippingLabel';
import {
  canPrintWaybill,
  resolveLabelTemplate,
  resolveLabelTemplateViewState,
} from '@/components/delivery/labels/labelTemplateState';
import { printOrderInvoice } from '@/components/delivery/invoices/printOrderInvoice';
import { deliveryDetailViewState } from '@/components/delivery/detailLoadState';
import { waybillRecipientPrintDecision } from '@/lib/delivery/waybillCompleteness';
import { waybillSenderDecision } from '@/lib/delivery/sender';
import { deliveryErrorStatus } from '@/lib/delivery/loadError';
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
  const { data: delivery, isLoading, isError, error, isFetching, refetch } =
    useDelivery(deliveryId);
  const detailState = deliveryDetailViewState({
    isLoading,
    isError,
    errorStatus: deliveryErrorStatus(error),
    hasDelivery: Boolean(delivery),
  });
  const {
    data: labelTemplate,
    branding,
    isLoading: templateLoading,
    isError: templateError,
    error: templateLoadError,
    isFetching: templateFetching,
    refetch: refetchTemplate,
  } = useLabelTemplate();
  const { hasPermission } = usePermissions();
  const canDispatch = hasPermission(PERMISSIONS.DELIVERY.dispatchDelivery);
  const prepare = useBulkCreateDelivery();

  const templateState = resolveLabelTemplateViewState({
    isError: templateError,
    isLoading: templateLoading,
    hasTemplate: Boolean(labelTemplate),
  });
  const waybillTemplate = resolveLabelTemplate(labelTemplate, branding);
  const canPrintWaybillNow = canPrintWaybill(templateState, waybillTemplate);
  const senderDecision = waybillSenderDecision(waybillTemplate);
  const recipientDecision = waybillRecipientPrintDecision(delivery?.address);
  const waybillBlockedReason = !canPrintWaybillNow
    ? templateState === 'error'
      ? 'Waybill template failed to load - retry before printing'
      : templateState !== 'ready'
        ? 'Waybill template is still loading'
        : senderDecision.reason ?? 'Sender details are missing from the Store Profile'
    : !recipientDecision.canPrint
      ? recipientDecision.reason
      : null;

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
    if (!canPrintWaybillNow) {
      toast.error(waybillBlockedReason ?? 'Waybill cannot be printed');
      return;
    }
    if (!recipientDecision.canPrint) {
      toast.error(recipientDecision.reason ?? 'Recipient address is incomplete');
      return;
    }
    void runPrint('waybill', async () => {
      printShippingLabel(delivery, waybillTemplate);
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
            {delivery?.orderRef ??
              (detailState === 'loading' ? 'Loading delivery...' : 'Delivery')}
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
              disabled={printing !== null || !canPrintWaybillNow || !recipientDecision.canPrint}
              aria-busy={printing === 'waybill'}
              title={waybillBlockedReason ?? undefined}
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
            {canDispatch && canPrepareDelivery(delivery.status) && (
              <Button
                variant="outline"
                onClick={() => prepare.mutate([delivery.id])}
                disabled={prepare.isPending}
                aria-busy={prepare.isPending}
                data-testid="delivery-prepare-button"
              >
                {prepare.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" data-testid="loading-spinner" />
                ) : null}
                {prepare.isPending ? 'Preparing...' : 'Prepare for delivery'}
              </Button>
            )}
            {canDispatch && delivery.status === 'PENDING_DISPATCH' && (
              <Button onClick={() => setDispatchOpen(true)} data-testid="delivery-dispatch-button">
                Dispatch
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Waybill template failure (ARGUS #298) */}
      {templateState === 'error' && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700"
        >
          <span>
            Waybill template failed to load - printing is disabled
            {templateLoadError instanceof Error ? ` (${templateLoadError.message})` : ''}.
          </span>
          <Button
            variant="outline"
            size="sm"
            className="border-red-200 bg-white text-red-700 hover:bg-red-100"
            onClick={() => refetchTemplate()}
            disabled={templateFetching}
          >
            {templateFetching ? 'Retrying…' : 'Retry'}
          </Button>
        </div>
      )}

      {/* Missing sender profile (ARGUS #301) */}
      {senderDecision.missing.length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 font-body text-sm text-amber-800"
        >
          <p className="font-medium">
            {senderDecision.canPrint
              ? 'Waybill sender address is missing.'
              : 'Waybill printing is blocked.'}
          </p>
          <p>{senderDecision.reason}. Update the Store Profile before printing.</p>
        </div>
      )}

      {/* Missing recipient block (ARGUS #300) */}
      {delivery && !recipientDecision.canPrint && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 font-body text-sm text-amber-800"
        >
          <p className="font-medium">Waybill printing is blocked.</p>
          <p>{recipientDecision.reason}. Add the shipping address before printing.</p>
        </div>
      )}

      {/* Loading */}
      {detailState === 'loading' && (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      )}

      {/* Not found (404 only) */}
      {detailState === 'not-found' && (
        <div className="rounded-lg border border-espresso/10 py-16 text-center">
          <p className="text-espresso/70">Delivery not found.</p>
          <p className="mt-1 text-sm text-espresso/40">
            It may have been removed, or the link may be incorrect.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => startTransition(() => router.push('/delivery'))}
          >
            Back to deliveries
          </Button>
        </div>
      )}

      {/* Load error (403/500/network) - retryable, never shown as 404 */}
      {detailState === 'error' && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 font-body text-sm text-red-700"
        >
          <div>
            <p className="font-medium">Could not load this delivery.</p>
            <p className="text-xs text-red-700/80">
              {error instanceof Error
                ? error.message
                : 'Check your connection or permissions and try again.'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-red-200 bg-white text-red-700 hover:bg-red-100"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="delivery-retry"
          >
            {isFetching ? 'Retrying...' : 'Retry'}
          </Button>
        </div>
      )}

      {/* Content */}
      {detailState === 'ready' && delivery && <DeliveryDetailPanel delivery={delivery} />}

      <DispatchSheet
        delivery={delivery ?? null}
        open={dispatchOpen}
        onClose={() => setDispatchOpen(false)}
      />
    </div>
  );
}
