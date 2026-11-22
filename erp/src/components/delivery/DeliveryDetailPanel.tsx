'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRupee, formatShortDateTime } from '@/lib/format';
import { collectableCodAmount } from '@/lib/delivery/cod';
import { describePayment } from '@/lib/delivery/payment';
import {
  deliveryLinesTotal,
  toDeliveryLineRows,
  toLineInputs,
} from './deliveryLineItems';
import { useShipmentTracking } from '@/hooks/delivery';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { StatusBadge } from './StatusBadge';
import { StatusTimeline } from './StatusTimeline';
import { CancelDeliveryDialog } from './CancelDeliveryDialog';
import { canCancelDelivery } from './cancelDelivery';
import {
  summarizeShipmentDeliveryStatus,
  type ShipmentDeliverySummary,
} from './shipmentStatusSummary';
import { RecoverySection } from './recovery/RecoverySection';
import type { DeliveryAddress, DeliveryDetail } from '@/types/delivery';

interface DeliveryDetailPanelProps {
  delivery: DeliveryDetail;
}

function OrderInfoCard({ delivery }: { delivery: DeliveryDetail }) {
  const address: DeliveryAddress = delivery.address ?? ({} as DeliveryAddress);
  const rows = [
    { label: 'Order Ref', value: delivery.orderRef },
    { label: 'Source', value: delivery.source ?? '-' },
    { label: 'COD (goods + shipping)', value: formatRupee(collectableCodAmount(delivery).toNumber()) },
    { label: 'Payment', value: describePayment(delivery.paymentMethod, delivery.paymentStatus) },
    { label: 'Goods Value', value: formatRupee(delivery.codAmount ?? 0) },
    { label: 'Declared Value', value: delivery.declaredValue != null ? formatRupee(delivery.declaredValue) : '-' },
    { label: 'Item Count', value: delivery.itemCount ?? '-' },
    { label: 'Total Weight', value: delivery.totalWeightKg != null ? `${delivery.totalWeightKg} kg` : '-' },
    { label: 'Shipping Fee', value: delivery.shippingFee != null ? formatRupee(delivery.shippingFee) : '-' },
    { label: 'Delivery Fee', value: delivery.deliveryFee != null ? formatRupee(delivery.deliveryFee) : '-' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-espresso">Order Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {delivery.customer && (
          <div className="rounded-lg bg-espresso/5 px-3 py-2">
            <p className="text-sm font-medium text-espresso">{delivery.customer.name}</p>
            {delivery.customer.phone && (
              <p className="text-xs text-espresso/60">{delivery.customer.phone}</p>
            )}
          </div>
        )}
        <div className="rounded-lg bg-espresso/5 px-3 py-2 space-y-0.5">
          <p className="text-sm font-medium text-espresso">{address.fullName ?? '-'}</p>
          <p className="text-xs text-espresso/60">{address.phone ?? ''}</p>
          <p className="text-xs text-espresso/60">{address.addressLine1 ?? ''}</p>
          {address.addressLine2 && (
            <p className="text-xs text-espresso/60">{address.addressLine2}</p>
          )}
          <p className="text-xs text-espresso/60">
            {[address.cityName, address.districtName].filter(Boolean).join(', ') || '-'}
          </p>
        </div>
        <dl className="space-y-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <dt className="text-sm text-espresso/50">{row.label}</dt>
              <dd className="text-sm font-medium text-espresso">{row.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

function DeliveryItemsCard({ delivery }: { delivery: DeliveryDetail }) {
  const lines = toLineInputs(delivery.lines);
  const rows = toDeliveryLineRows(lines);
  const lineTotal = deliveryLinesTotal(lines);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-espresso">Items</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-espresso/50">
            No item lines were recorded for this delivery.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-espresso/10 text-left text-xs text-espresso/50">
                  <th className="py-2 pr-3 font-medium">Product</th>
                  <th className="py-2 pr-3 font-medium">SKU</th>
                  <th className="py-2 pr-3 text-right font-medium">Qty</th>
                  <th className="py-2 pr-3 text-right font-medium">Unit price</th>
                  <th className="py-2 text-right font-medium">Line total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((line, index) => (
                  <tr
                    key={line.id ?? `${line.sku}-${index}`}
                    className="border-b border-espresso/5 last:border-0"
                  >
                    <td className="py-2 pr-3 text-espresso">{line.productName}</td>
                    <td className="py-2 pr-3 text-espresso/60">{line.sku}</td>
                    <td className="py-2 pr-3 text-right text-espresso/60">{line.quantity}</td>
                    <td className="py-2 pr-3 text-right text-espresso/60">
                      {formatRupee(line.unitPrice)}
                    </td>
                    <td className="py-2 text-right text-espresso">
                      {formatRupee(line.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="pt-2 text-right text-xs text-espresso/50">
                    Recorded line total
                  </td>
                  <td className="pt-2 text-right text-sm font-medium text-espresso">
                    {formatRupee(lineTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ShipmentStatusCard({
  delivery,
  tracking,
  summary,
}: {
  delivery: DeliveryDetail;
  tracking: ReturnType<typeof useShipmentTracking>;
  summary: ShipmentDeliverySummary;
}) {
  const shipment = delivery.shipments?.[0];
  const waybill = delivery.waybill ?? shipment?.waybillId;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-espresso">Shipment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-espresso/50">Shipment status</p>
            <div className="mt-1">
              {shipment ? (
                <StatusBadge status={shipment.status} />
              ) : (
                <span className="text-sm text-espresso/50">No shipment</span>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-espresso/50">Delivery status</p>
            <div className="mt-1">
              <StatusBadge status={delivery.status} />
            </div>
          </div>
        </div>

        {summary.hint && (
          <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
            {summary.hint}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-espresso/50">Waybill</p>
            <p className="text-sm font-medium text-espresso">{waybill ?? '-'}</p>
          </div>
        </div>
        {shipment?.carrierLastSyncedAt && (
          <p className="text-xs text-espresso/40">
            Last synced: {formatShortDateTime(shipment.carrierLastSyncedAt)}
          </p>
        )}
        {waybill && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => tracking.refresh()}
            disabled={tracking.isRefreshing}
            aria-busy={tracking.isRefreshing}
          >
            {tracking.isRefreshing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" data-testid="loading-spinner" />
            ) : null}
            {tracking.isRefreshing ? 'Tracking…' : 'Track'}
          </Button>
        )}
        {tracking.data?.currentStatus && (
          <div className="rounded-lg bg-espresso/5 px-3 py-2 text-sm text-espresso/70">
            Carrier reports: {tracking.data.currentStatus}
          </div>
        )}
        {tracking.error && (
          <p role="alert" className="text-xs text-red-600">
            {tracking.error.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function DeliveryDetailPanel({ delivery }: DeliveryDetailPanelProps) {
  const { hasPermission } = usePermissions();
  const canCancel =
    hasPermission(PERMISSIONS.DELIVERY.cancelDelivery) &&
    canCancelDelivery(delivery.status);
  const [cancelOpen, setCancelOpen] = useState(false);

  const shipment = delivery.shipments?.[0] ?? null;
  const tracking = useShipmentTracking(shipment?.id ?? null, delivery.id);
  const summary = summarizeShipmentDeliveryStatus(shipment?.status, delivery.status);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <OrderInfoCard delivery={delivery} />
        <DeliveryItemsCard delivery={delivery} />
        <ShipmentStatusCard delivery={delivery} tracking={tracking} summary={summary} />
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-espresso">Status Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusTimeline events={delivery.events ?? []} />
          </CardContent>
        </Card>

        <RecoverySection delivery={delivery} />

        {canCancel && (
          <Button
            variant="outline"
            className="text-terracotta"
            onClick={() => setCancelOpen(true)}
            data-testid="delivery-cancel-button"
          >
            Cancel Delivery
          </Button>
        )}
      </div>

      <CancelDeliveryDialog
        delivery={delivery}
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
      />
    </div>
  );
}
