'use client';

import { Button } from '@/components/ui/button';
import { Printer, Package, Tag, FileText, Loader2 } from 'lucide-react';

interface BulkActionBarProps {
  count: number;
  canEdit: boolean;
  canDispatch: boolean;
  onStatusChange: () => void;
  onCreateDelivery: () => void;
  onPrint: () => void;
  onPrintInvoices: () => void;
  /** "Prepare for delivery" mutation is running. */
  isCreatingDelivery?: boolean;
  /** Bulk waybill printing is running (dialog open / overlay cleanup). */
  isPrintingWaybills?: boolean;
  /** Bulk invoice printing is running. */
  isPrintingInvoices?: boolean;
  /** Any action is running; the remaining buttons stay disabled. */
  isBusy?: boolean;
  /** Waybill template is still loading/failed; print must stay disabled. */
  waybillPrintDisabled?: boolean;
}

export function BulkActionBar({
  count,
  canEdit,
  canDispatch,
  onStatusChange,
  onCreateDelivery,
  onPrint,
  onPrintInvoices,
  isCreatingDelivery = false,
  isPrintingWaybills = false,
  isPrintingInvoices = false,
  isBusy = false,
  waybillPrintDisabled = false,
}: BulkActionBarProps) {
  if (count === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-espresso/10 bg-pearl px-4 py-2.5">
      <span className="text-sm font-medium text-espresso">{count} selected</span>
      {canEdit && (
        <Button
          size="sm"
          variant="outline"
          onClick={onStatusChange}
          disabled={isBusy || isCreatingDelivery || isPrintingWaybills || isPrintingInvoices}
        >
          <Tag className="mr-1.5 h-4 w-4" />
          Change status
        </Button>
      )}
      {canDispatch && (
        <Button
          size="sm"
          variant="outline"
          onClick={onCreateDelivery}
          disabled={isBusy || isCreatingDelivery || isPrintingWaybills || isPrintingInvoices}
          aria-busy={isCreatingDelivery}
        >
          {isCreatingDelivery ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" data-testid="loading-spinner" />
          ) : (
            <Package className="mr-1.5 h-4 w-4" />
          )}
          {isCreatingDelivery ? 'Preparing…' : 'Prepare for delivery'}
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={onPrint}
        disabled={isBusy || isPrintingInvoices || waybillPrintDisabled}
        aria-busy={isPrintingWaybills}
        title={waybillPrintDisabled ? 'Waybill printing is disabled' : undefined}
        data-testid="bulk-waybills"
      >
        {isPrintingWaybills ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" data-testid="loading-spinner" />
        ) : (
          <Printer className="mr-1.5 h-4 w-4" />
        )}
        {isPrintingWaybills ? 'Preparing waybills…' : 'Waybills'}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={onPrintInvoices}
        disabled={isBusy || isPrintingWaybills}
        aria-busy={isPrintingInvoices}
        data-testid="bulk-invoices"
      >
        {isPrintingInvoices ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" data-testid="loading-spinner" />
        ) : (
          <FileText className="mr-1.5 h-4 w-4" />
        )}
        {isPrintingInvoices ? 'Printing invoices…' : 'Print invoices'}
      </Button>
    </div>
  );
}
