'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRupee } from '@/lib/format';
import { useCancelDelivery, useShipmentTracking } from '@/hooks/delivery';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { StatusBadge } from './StatusBadge';
import { StatusTimeline } from './StatusTimeline';
import type { DeliveryAddress, DeliveryDetail } from '@/types/delivery';

interface DeliveryDetailPanelProps {
  delivery: DeliveryDetail;
}

function OrderInfoCard({ delivery }: { delivery: DeliveryDetail }) {
  const address: DeliveryAddress = delivery.address ?? ({} as DeliveryAddress);
  const rows = [
    { label: 'Order Ref', value: delivery.orderRef },
    { label: 'Source', value: delivery.source ?? '—' },
    { label: 'COD', value: formatRupee(delivery.codAmount ?? 0) },
    { label: 'Declared Value', value: delivery.declaredValue != null ? formatRupee(delivery.declaredValue) : '—' },
    { label: 'Item Count', value: delivery.itemCount ?? '—' },
    { label: 'Total Weight', value: delivery.totalWeightKg != null ? `${delivery.totalWeightKg} kg` : '—' },
    { label: 'Shipping Fee', value: delivery.shippingFee != null ? formatRupee(delivery.shippingFee) : '—' },
    { label: 'Delivery Fee', value: delivery.deliveryFee != null ? formatRupee(delivery.deliveryFee) : '—' },
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
          <p className="text-sm font-medium text-espresso">{address.fullName ?? '—'}</p>
          <p className="text-xs text-espresso/60">{address.phone ?? ''}</p>
          <p className="text-xs text-espresso/60">{address.addressLine1 ?? ''}</p>
          {address.addressLine2 && (
            <p className="text-xs text-espresso/60">{address.addressLine2}</p>
          )}
          <p className="text-xs text-espresso/60">
            {[address.cityName, address.districtName].filter(Boolean).join(', ') || '—'}
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

function ShipmentStatusCard({ delivery }: { delivery: DeliveryDetail }) {
  const shipment = delivery.shipments?.[0];
  const waybill = delivery.waybill ?? shipment?.waybillId;
  const tracking = useShipmentTracking(shipment?.id ?? null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-espresso">Shipment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-espresso/50">Waybill</p>
            <p className="text-sm font-medium text-espresso">{waybill ?? '—'}</p>
          </div>
          <StatusBadge status={delivery.status} />
        </div>
        {shipment?.carrierLastSyncedAt && (
          <p className="text-xs text-espresso/40">
            Last synced:{' '}
            {new Date(shipment.carrierLastSyncedAt).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
        {waybill && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => tracking.refresh()}
            disabled={tracking.isLoading}
          >
            {tracking.isLoading ? 'Tracking...' : 'Track'}
          </Button>
        )}
        {tracking.data && (
          <div className="rounded-lg bg-espresso/5 px-3 py-2 text-sm text-espresso/70">
            {tracking.data.status ?? 'No tracking updates'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DeliveryDetailPanel({ delivery }: DeliveryDetailPanelProps) {
  const cancel = useCancelDelivery();
  const { hasPermission } = usePermissions();
  const canCancel = hasPermission(PERMISSIONS.DELIVERY.cancelDelivery);
  const isPending = delivery.status === 'PENDING_DISPATCH';

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <OrderInfoCard delivery={delivery} />
        <ShipmentStatusCard delivery={delivery} />
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

        {canCancel && isPending && (
          <Button
            variant="outline"
            className="text-terracotta"
            onClick={() => cancel.mutate({ id: delivery.id })}
            disabled={cancel.isPending}
          >
            {cancel.isPending ? 'Cancelling...' : 'Cancel Delivery'}
          </Button>
        )}
      </div>
    </div>
  );
}
