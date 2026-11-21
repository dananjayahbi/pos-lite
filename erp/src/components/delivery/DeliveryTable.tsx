'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { formatRupee } from '@/lib/format';
import { collectableCodAmount } from '@/lib/delivery/cod';
import { waitForPrintOverlayToClose } from '@/lib/print-session';
import { StatusBadge } from './StatusBadge';
import { FailureReasonTag } from './FailureReasonTag';
import { DispatchSheet } from './DispatchSheet';
import { CancelDeliveryDialog } from './CancelDeliveryDialog';
import { canCancelDelivery } from './cancelDelivery';
import {
  deliveryPrintButtonState,
  deliveryPrintKey,
  type DeliveryPrintAction,
} from './printState';
import { printShippingLabel } from './labels/ShippingLabel';
import { printOrderInvoice } from './invoices/printOrderInvoice';
import { usePermissions } from '@/hooks/usePermissions';
import { useLabelTemplate } from '@/hooks/delivery';
import { PERMISSIONS } from '@/lib/constants/permissions';
import {
  canPrintWaybill,
  resolveLabelTemplate,
  resolveLabelTemplateViewState,
} from './labels/labelTemplateState';
import type { DeliveryListItem } from '@/types/delivery';

interface DeliveryTableProps {
  deliveries: DeliveryListItem[];
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DeliveryTable({ deliveries }: DeliveryTableProps) {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const {
    data: labelTemplate,
    branding,
    isLoading: templateLoading,
    isError: templateError,
    isFetching: templateFetching,
    refetch: refetchTemplate,
  } = useLabelTemplate();
  const templateState = resolveLabelTemplateViewState({
    isError: templateError,
    isLoading: templateLoading,
    hasTemplate: Boolean(labelTemplate),
  });
  const waybillTemplate = resolveLabelTemplate(labelTemplate, branding);
  const canPrintWaybillNow = canPrintWaybill(templateState, waybillTemplate);
  const canDispatch = hasPermission(PERMISSIONS.DELIVERY.dispatchDelivery);
  const canCancel = hasPermission(PERMISSIONS.DELIVERY.cancelDelivery);

  const [dispatchTarget, setDispatchTarget] = useState<DeliveryListItem | null>(null);
  const [cancelTarget, setCancelTarget] = useState<DeliveryListItem | null>(null);
  /** Active print key (`waybill:<id>` / `invoice:<id>`) for row spinners. */
  const [printing, setPrinting] = useState<string | null>(null);

  const runPrint = async (
    action: DeliveryPrintAction,
    delivery: DeliveryListItem,
    task: () => Promise<void>,
  ) => {
    setPrinting(deliveryPrintKey(action, delivery.id));
    try {
      await task();
      await waitForPrintOverlayToClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Printing failed');
    } finally {
      setPrinting(null);
    }
  };

  const handlePrint = (delivery: DeliveryListItem) => {
    if (!canPrintWaybillNow) {
      toast.error('Waybill template is not loaded');
      return;
    }
    void runPrint('waybill', delivery, async () => {
      printShippingLabel(delivery, waybillTemplate);
    });
  };

  const handlePrintInvoice = (delivery: DeliveryListItem) => {
    void runPrint('invoice', delivery, () => printOrderInvoice(delivery.id));
  };

  return (
    <>
      {templateState === 'error' && (
        <div
          role="alert"
          className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 font-body text-sm text-red-700"
        >
          <span>Waybill template failed to load - printing is disabled.</span>
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
      <div className="overflow-x-auto rounded-lg border border-espresso/10">
        <table className="w-full">
          <thead>
            <tr className="border-b border-espresso/10 bg-espresso/5">
              <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Order Ref</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">City</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">COD</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Shipping Fee</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Waybill</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Dispatched At</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-espresso/60">Actions</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((d) => {
              const shipment = d.shipments?.[0];
              const waybill = d.waybill ?? shipment?.waybillId;
              const isPending = canCancelDelivery(d.status);
              const waybillPrint = deliveryPrintButtonState(printing, 'waybill', d.id);
              const invoicePrint = deliveryPrintButtonState(printing, 'invoice', d.id);
              return (
                <tr
                  key={d.id}
                  className="border-b border-espresso/5 hover:bg-espresso/5 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-medium text-espresso">{d.orderRef}</td>
                  <td className="px-4 py-3 text-sm text-espresso">
                    {d.customer?.name ?? d.address?.fullName ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-espresso/60">
                    {d.address?.cityName ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-espresso">
                    {formatRupee(collectableCodAmount(d).toNumber())}
                  </td>
                  <td className="px-4 py-3 text-sm text-espresso/60">
                    {d.shippingFee != null ? formatRupee(d.shippingFee) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge status={d.status} />
                      {d.status === 'FAILED' && <FailureReasonTag reason={d.failureReason} />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-espresso/60">{waybill ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-espresso/60">
                    {formatDate(d.dispatchedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/delivery/${d.id}`)}
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePrint(d)}
                        disabled={!canPrintWaybillNow || waybillPrint.isBusy}
                        aria-busy={waybillPrint.isActive}
                        title={
                          !canPrintWaybillNow
                            ? 'Waybill template is not loaded'
                            : undefined
                        }
                        data-testid={`delivery-waybill-${d.id}`}
                      >
                        {waybillPrint.isActive ? (
                          <Loader2
                            className="mr-1.5 h-3.5 w-3.5 animate-spin"
                            data-testid="loading-spinner"
                          />
                        ) : null}
                        {waybillPrint.isActive ? 'Preparing...' : 'Print'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePrintInvoice(d)}
                        disabled={invoicePrint.isBusy}
                        aria-busy={invoicePrint.isActive}
                        data-testid={`delivery-invoice-${d.id}`}
                      >
                        {invoicePrint.isActive ? (
                          <Loader2
                            className="mr-1.5 h-3.5 w-3.5 animate-spin"
                            data-testid="loading-spinner"
                          />
                        ) : null}
                        {invoicePrint.isActive ? 'Preparing...' : 'Invoice'}
                      </Button>
                      {canDispatch && d.status === 'PENDING_DISPATCH' && (
                        <Button size="sm" variant="outline" onClick={() => setDispatchTarget(d)}>
                          Dispatch
                        </Button>
                      )}
                      {canCancel && isPending && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-terracotta"
                          onClick={() => setCancelTarget(d)}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <DispatchSheet
        delivery={dispatchTarget}
        open={!!dispatchTarget}
        onClose={() => setDispatchTarget(null)}
      />

      <CancelDeliveryDialog
        delivery={cancelTarget}
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
      />
    </>
  );
}
