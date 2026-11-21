'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/hooks/usePermissions';
import { useLabelTemplate } from '@/hooks/delivery';
import {
  ORDERS_PAGE_SIZE,
  useOrders,
  useBulkStatusChange,
  useBulkCreateDelivery,
} from '@/hooks/orders';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { printShippingLabels } from '@/components/delivery/labels/ShippingLabel';
import {
  canPrintWaybill,
  resolveLabelTemplate,
  resolveLabelTemplateViewState,
} from '@/components/delivery/labels/labelTemplateState';
import { printOrderInvoice, printOrderInvoices } from '@/components/delivery/invoices/printOrderInvoice';
import { waitForPrintOverlayToClose } from '@/lib/print-session';
import { toast } from 'sonner';
import { OrderFilters } from '@/components/orders/OrderFilters';
import { OrdersTable } from '@/components/orders/OrdersTable';
import { BulkActionBar } from '@/components/orders/BulkActionBar';
import { BulkStatusDialog } from '@/components/orders/BulkStatusDialog';
import { paginationSummary } from '@/components/orders/pagination';
import { retainFailedSelection, summarizeBulkResults } from '@/components/orders/bulkResult';
import {
  pruneSelection,
  toggleAllVisible,
  toggleSelection,
  visibleSelectedIds,
} from '@/components/orders/selection';
import { commonBulkStatusTargets } from '@/lib/services/dispatchStatus.core';
import type { DeliveryListItem } from '@/types/delivery';
import type { DeliveryStatus } from '@/generated/prisma/client';

export function OrdersPageClient() {
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission(PERMISSIONS.DELIVERY.editDelivery);
  const canDispatch = hasPermission(PERMISSIONS.DELIVERY.dispatchDelivery);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<DeliveryStatus | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  /** Which print action is currently running (`bulk-*` or `<kind>:<id>`). */
  const [printBusy, setPrintBusy] = useState<string | null>(null);

  const { data, isLoading } = useOrders({
    status,
    search,
    page,
    limit: ORDERS_PAGE_SIZE,
  });
  const {
    data: labelTemplate,
    branding,
    isLoading: templateLoading,
    isError: templateError,
    isFetching: templateFetching,
    refetch: refetchTemplate,
  } = useLabelTemplate();
  const bulkStatus = useBulkStatusChange();
  const bulkCreate = useBulkCreateDelivery();

  const orders = useMemo(() => (data?.items ?? []) as DeliveryListItem[], [data]);
  const total = data?.total ?? 0;
  const summary = paginationSummary(page, data?.limit ?? ORDERS_PAGE_SIZE, total);
  const templateState = resolveLabelTemplateViewState({
    isError: templateError,
    isLoading: templateLoading,
    hasTemplate: Boolean(labelTemplate),
  });
  const template = resolveLabelTemplate(labelTemplate, branding);
  const canPrintWaybillNow = canPrintWaybill(templateState, template);

  // Filters and paging clear the selection: bulk actions never silently include
  // rows the operator can no longer see (ARGUS #262).
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
    setSelectedIds(new Set());
  };

  const handleStatusFilterChange = (value: DeliveryStatus | null) => {
    setStatus(value);
    setPage(1);
    setSelectedIds(new Set());
  };

  const goToPage = (next: number) => {
    setPage(Math.min(Math.max(1, next), summary.totalPages));
    setSelectedIds(new Set());
  };

  const toggle = (id: string) => setSelectedIds((prev) => toggleSelection(prev, id));

  const toggleAll = () => setSelectedIds((prev) => toggleAllVisible(prev, orders));

  // ARGUS #264: every action reads the same visible selection. Ids left over
  // from a previous page/filter are pruned here, so the bulk count and the ids
  // sent to status/prepare/print can never disagree.
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = pruneSelection(prev, orders);
      return next.size === prev.size ? prev : next;
    });
  }, [orders]);

  const selectedVisibleIds = useMemo(
    () => visibleSelectedIds(selectedIds, orders),
    [selectedIds, orders],
  );
  const selectedOrders = useMemo(
    () => orders.filter((o) => selectedIds.has(o.id)),
    [selectedIds, orders],
  );

  // ARGUS #263: only offer statuses legal for every selected order. A mixed
  // pre-dispatch/dispatched selection gets an empty list instead of a menu
  // that would silently bypass dispatch or recovery controls.
  const allowedBulkStatuses = commonBulkStatusTargets(
    selectedOrders.map((order) => ({
      status: order.status,
      hasShipment: Boolean(order.shipments?.[0]),
    })),
  );

  const handleStatusChange = (newStatus: DeliveryStatus) => {
    const ids = selectedVisibleIds;
    bulkStatus.mutate(
      { deliveryIds: ids, status: newStatus },
      {
        onSuccess: (results) => {
          const summary = summarizeBulkResults(results);
          // ARGUS #265: keep the dialog and the failed rows when nothing moved.
          if (summary.okCount === 0) return;
          setSelectedIds((prev) => retainFailedSelection(prev, results));
          setStatusDialogOpen(false);
        },
      },
    );
  };

  const handleCreateDelivery = () => {
    const ids = selectedVisibleIds;
    bulkCreate.mutate(ids, {
      onSuccess: (results) => {
        // Failed rows stay selected so they can be retried; never clear the
        // selection when every row was rejected.
        if (summarizeBulkResults(results).okCount === 0) return;
        setSelectedIds((prev) => retainFailedSelection(prev, results));
      },
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

  const ensureWaybillTemplate = () => {
    if (canPrintWaybillNow) return true;
    toast.error(
      templateState === 'error'
        ? 'Waybill template failed to load - retry before printing'
        : 'Waybill template is still loading',
    );
    return false;
  };

  const handlePrint = () => {
    if (selectedOrders.length === 0) return;
    if (!ensureWaybillTemplate()) return;
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
    if (!ensureWaybillTemplate()) return;
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

      {templateState === 'error' && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 font-body text-sm text-red-700"
        >
          <span>Waybill template failed to load - waybill printing is disabled.</span>
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

      <OrderFilters
        search={search}
        status={status}
        onSearchChange={handleSearchChange}
        onStatusChange={handleStatusFilterChange}
      />

      <BulkActionBar
        count={selectedVisibleIds.length}
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
        waybillPrintDisabled={!canPrintWaybillNow}
      />

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 font-body text-sm text-espresso/60">
          <span>
            Showing {summary.start}–{summary.end} of {total} order{total === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1 || isLoading}
              aria-label="Previous page"
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <span>
              Page {Math.min(page, summary.totalPages)} of {summary.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page + 1)}
              disabled={page >= summary.totalPages || isLoading}
              aria-label="Next page"
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

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
          waybillPrintDisabled={!canPrintWaybillNow}
        />
      )}

      {statusDialogOpen && (
        <BulkStatusDialog
          count={selectedVisibleIds.length}
          allowedStatuses={allowedBulkStatuses}
          onCancel={() => setStatusDialogOpen(false)}
          onConfirm={handleStatusChange}
          isPending={bulkStatus.isPending}
        />
      )}
    </div>
  );
}
