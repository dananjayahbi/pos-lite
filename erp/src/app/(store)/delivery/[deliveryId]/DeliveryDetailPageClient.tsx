'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDelivery } from '@/hooks/delivery';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { StatusBadge } from '@/components/delivery/StatusBadge';
import { DeliveryDetailPanel } from '@/components/delivery/DeliveryDetailPanel';
import { DispatchSheet } from '@/components/delivery/DispatchSheet';
import { useState } from 'react';

interface DeliveryDetailPageClientProps {
  deliveryId: string;
}

export function DeliveryDetailPageClient({ deliveryId }: DeliveryDetailPageClientProps) {
  const router = useRouter();
  const { data: delivery, isLoading } = useDelivery(deliveryId);
  const { hasPermission } = usePermissions();
  const canDispatch = hasPermission(PERMISSIONS.DELIVERY.dispatchDelivery);

  const [dispatchOpen, setDispatchOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push('/delivery')}>
            ← Back
          </Button>
          <h1 className="text-xl font-semibold text-espresso">
            {delivery ? delivery.orderRef : 'Delivery'}
          </h1>
          {delivery && <StatusBadge status={delivery.status} />}
        </div>

        {canDispatch && delivery?.status === 'PENDING_DISPATCH' && (
          <Button onClick={() => setDispatchOpen(true)}>Dispatch</Button>
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
