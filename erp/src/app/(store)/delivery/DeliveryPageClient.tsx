'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDeliveries } from '@/hooks/delivery';
import { useDeliveryStore } from '@/stores/deliveryStore';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { DeliveryTable } from '@/components/delivery/DeliveryTable';
import { CreateDeliverySheet } from '@/components/delivery/CreateDeliverySheet';
import type { DeliveryStatus } from '@/generated/prisma/client';

const STATUS_OPTIONS = [
  'PLACED',
  'PENDING_DISPATCH',
  'HOLD',
  'PENDING_PICKUP',
  'DISPATCHED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'FAILED',
  'RETURNED',
  'CANCELED',
];

export function DeliveryPageClient() {
  const statusFilter = useDeliveryStore((s) => s.statusFilter);
  const setStatusFilter = useDeliveryStore((s) => s.setStatusFilter);
  const search = useDeliveryStore((s) => s.search);
  const setSearch = useDeliveryStore((s) => s.setSearch);
  const isCreateOpen = useDeliveryStore((s) => s.isCreateOpen);
  const openCreate = useDeliveryStore((s) => s.openCreate);
  const closeCreate = useDeliveryStore((s) => s.closeCreate);

  const { hasPermission } = usePermissions();
  const canCreate = hasPermission(PERMISSIONS.DELIVERY.createDelivery);

  const { data, isLoading, isError, error } = useDeliveries({
    status: statusFilter as DeliveryStatus | null | undefined,
    search,
  });
  const deliveries = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-espresso">Deliveries &amp; Tracking</h1>
        <p className="mt-1 font-body text-sm text-sand-ink">
          Track parcels from order creation through dispatch, delivery and recovery.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search orders, customers, phone, waybills..."
            className="w-full sm:w-64"
          />
          <Select
            value={statusFilter ?? '__all'}
            onValueChange={(v) => setStatusFilter(v === '__all' ? null : v)}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {status.replace(/_/g, ' ').toLowerCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canCreate && (
          <Button onClick={openCreate} className="shrink-0 self-start lg:self-auto">
            Create Delivery
          </Button>
        )}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {/* Empty */}
      {!isLoading && isError && (
        <div className="rounded-lg border border-terracotta/30 bg-terracotta/5 py-10 text-center text-sm text-terracotta">
          Could not load deliveries: {error instanceof Error ? error.message : 'unknown error'}
        </div>
      )}

      {!isLoading && !isError && deliveries.length === 0 && (
        <div className="rounded-lg border border-espresso/10 py-16 text-center">
          <p className="text-espresso/60">No deliveries found.</p>
          {canCreate && (
            <p className="mt-1 text-sm text-espresso/40">
              Create a delivery or adjust your filters.
            </p>
          )}
        </div>
      )}

      {/* Table */}
      {!isLoading && deliveries.length > 0 && <DeliveryTable deliveries={deliveries} />}

      <CreateDeliverySheet open={isCreateOpen} onOpenChange={closeCreate} />
    </div>
  );
}
