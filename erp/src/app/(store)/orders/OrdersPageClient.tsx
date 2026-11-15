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
import { waitForPrintOverlayToClose } from '@/lib/print-session';
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
  /** Which print action is currently running (`bulk-*` or `<kind>:<id>`). */
  const [printBusy, setPrintBusy] = useState<string | null>(null);

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
    const ids = Array.from(selectedIds);
    bulkStatus.mutate(
      { deliveryIds: ids, status: newStatus },
      {
        onSuccess: () => {
          setStatusDialogOpen(false);
          setSelectedIds(new Set());
        },
      },
    );
  };

  const handleCreateDelivery = () => {
    const ids = Array.from(selectedIds);
    bulkCreate.mutate(ids, {
      onSuccess: () => setSelectedIds(new Set()),
    });
  };

  const runPrint = async (key: string, action: () => Promise<void>) => {
    setPrintBusy(key);
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Printing failed');
    } finally {
      setPrintBusy(null);
    }
  };

  const handlePrint = () => {
    if (selectedOrders.length === 0) return;
    void runPrint('bulk-waybills', async () => {
      printShippingLabels(selectedOrders, template);
      await waitForPrintOverlayToClose();
    });
  };

  const handlePrintInvoices = () => {
    const ids = selectedOrders.map((o) => o.id);
    if (ids.length === 0) return;
    void runPrint('bulk-invoices', async () => {
      await printOrderInvoices(ids);
      await waitForPrintOverlayToClose();
    });
  };

  const handlePrintSingleWaybill = (order: DeliveryListItem) => {
    void runPrint(`waybill:${order.id}`, async () => {
      printShippingLabels([order], template);
      await waitForPrintOverlayToClose();
    });
  };

  const handlePrintSingleInvoice = (order: DeliveryListItem) => {
    void runPrint(`invoice:${order.id}`, async () => {
      await printOrderInvoice(order.id);
      await waitForPrintOverlayToClose();
    });
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
        isCreatingDelivery={bulkCreate.isPending}
        isPrintingWaybills={printBusy === 'bulk-waybills'}
        isPrintingInvoices={printBusy === 'bulk-invoices'}
        isBusy={printBusy !== null || bulkCreate.isPending || bulkStatus.isPending}
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
          onPrint={handlePrintSingleWaybill}
          onPrintInvoice={handlePrintSingleInvoice}
          printingWaybillId={
            printBusy?.startsWith('waybill:') ? printBusy.slice('waybill:'.length) : null
          }
          printingInvoiceId={
            printBusy?.startsWith('invoice:') ? printBusy.slice('invoice:'.length) : null
          }
          printBusy={printBusy !== null}
        />
      )}

      {statusDialogOpen && (
        <BulkStatusDialog
          count={selectedIds.size}
          onCancel={() => setStatusDialogOpen(false)}
          onConfirm={handleStatusChange}
          isPending={bulkStatus.isPending}
        />
      )}
    </div>
  );
}
