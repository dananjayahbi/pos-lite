'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/hooks/usePermissions';
import { useLabelTemplate } from '@/hooks/delivery';
import {
  useOrders,
  useBulkStatusChange,
  useBulkCreateDelivery,
} from '@/hooks/orders';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { DEFAULT_LABEL_TEMPLATE } from '@/lib/constants/label';
import { printShippingLabels } from '@/components/delivery/labels/ShippingLabel';
import { printOrderInvoice, printOrderInvoices } from '@/components/delivery/invoices/printOrderInvoice';
import { toast } from 'sonner';
import { OrderFilters } from '@/components/orders/OrderFilters';
import { OrdersTable } from '@/components/orders/OrdersTable';
import { BulkActionBar } from '@/components/orders/BulkActionBar';
import { BulkStatusDialog } from '@/components/orders/BulkStatusDialog';
import type { DeliveryListItem } from '@/types/delivery';
import type { DeliveryStatus } from '@/generated/prisma/client';

export function OrdersPageClient() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission(PERMISSIONS.DELIVERY.editDelivery);
  const canDispatch = hasPermission(PERMISSIONS.DELIVERY.dispatchDelivery);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<DeliveryStatus | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);

  const { data, isLoading } = useOrders({ status, search });
  const { data: labelTemplate } = useLabelTemplate();
  const bulkStatus = useBulkStatusChange();
  const bulkCreate = useBulkCreateDelivery();

  const orders = useMemo(() => (data?.items ?? []) as DeliveryListItem[], [data]);
  const template = labelTemplate ?? DEFAULT_LABEL_TEMPLATE;

  const toggle = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelectedIds((prev) => {
      if (prev.size === orders.length) return new Set();
      return new Set(orders.map((o) => o.id));
    });

  const selectedOrders = orders.filter((o) => selectedIds.has(o.id));

  const handleStatusChange = (newStatus: DeliveryStatus) => {
    setStatusDialogOpen(false);
    const ids = Array.from(selectedIds);
    bulkStatus.mutate({ deliveryIds: ids, status: newStatus });
    setSelectedIds(new Set());
  };

  const handleCreateDelivery = () => {
    const ids = Array.from(selectedIds);
    bulkCreate.mutate(ids);
    setSelectedIds(new Set());
  };

  const handlePrint = () => {
    printShippingLabels(selectedOrders, template);
  };

  const handlePrintInvoices = () => {
    const ids = selectedOrders.map((o) => o.id);
    void printOrderInvoices(ids).catch((e: Error) => toast.error(e.message));
  };

  const handlePrintSingleInvoice = (order: DeliveryListItem) => {
    void printOrderInvoice(order.id).catch((e: Error) => toast.error(e.message));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-bold text-espresso">Orders</h1>
      </div>

      <OrderFilters
        search={search}
        status={status}
        onSearchChange={setSearch}
        onStatusChange={setStatus}
      />

      <BulkActionBar
        count={selectedIds.size}
        canEdit={canEdit}
        canDispatch={canDispatch}
        onStatusChange={() => setStatusDialogOpen(true)}
        onCreateDelivery={handleCreateDelivery}
        onPrint={handlePrint}
        onPrintInvoices={handlePrintInvoices}
      />

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {!isLoading && orders.length === 0 && (
        <div className="rounded-lg border border-espresso/10 py-16 text-center">
          <p className="text-espresso/60">No orders found.</p>
        </div>
      )}

      {!isLoading && orders.length > 0 && (
        <OrdersTable
          orders={orders}
          selectedIds={selectedIds}
          onToggle={toggle}
          onToggleAll={toggleAll}
          onView={(id) => router.push(`/delivery/${id}`)}
          onPrint={(order) => printShippingLabels([order], template)}
          onPrintInvoice={handlePrintSingleInvoice}
        />
      )}

      {statusDialogOpen && (
        <BulkStatusDialog
          count={selectedIds.size}
          onCancel={() => setStatusDialogOpen(false)}
          onConfirm={handleStatusChange}
        />
      )}
    </div>
  );
}
