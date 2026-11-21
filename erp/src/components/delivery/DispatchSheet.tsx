'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DispatchDeliverySchema,
} from '@/lib/validators/delivery.validators';
import { useDispatchDelivery, useLabelTemplate, usePackagingDispatchOptions } from '@/hooks/delivery';
import { DispatchRequestError, type DispatchShortfallItem } from '@/hooks/delivery';
import {
  packagingSelectionTotals,
  suggestedPackagingItemIds,
  togglePackagingItemId,
} from '@/lib/packaging/packagingSelection.core';
import { formatPackagingQuantity } from '@/lib/constants/packaging';
import { formatRupee } from '@/lib/format';
import { collectableCodAmount } from '@/lib/delivery/cod';
import { describePayment } from '@/lib/delivery/payment';
import { dispatchWaybillAction } from '@/lib/delivery/dispatchWaybill.core';
import { waybillRecipientPrintDecision } from '@/lib/delivery/waybillCompleteness';
import { waybillSenderDecision } from '@/lib/delivery/sender';
import { printShippingLabel } from './labels/ShippingLabel';
import {
  canPrintWaybill,
  resolveLabelTemplate,
  resolveLabelTemplateViewState,
} from './labels/labelTemplateState';
import { waitForPrintOverlayToClose } from '@/lib/print-session';
import { toast } from 'sonner';
import type { DeliveryListItem } from '@/types/delivery';

interface DispatchSheetProps {
  delivery: DeliveryListItem | null;
  open: boolean;
  onClose: () => void;
}

export function DispatchSheet({ delivery, open, onClose }: DispatchSheetProps) {
  const dispatch = useDispatchDelivery();
  const {
    data: labelTemplate,
    branding,
    isLoading: templateLoading,
    isError: templateError,
  } = useLabelTemplate();
  const templateState = resolveLabelTemplateViewState({
    isError: templateError,
    isLoading: templateLoading,
    hasTemplate: Boolean(labelTemplate),
  });
  const waybillTemplate = resolveLabelTemplate(labelTemplate, branding);
  const canPrintWaybillNow = canPrintWaybill(templateState, waybillTemplate);
  const senderDecision = waybillSenderDecision(waybillTemplate);
  const recipientDecision = waybillRecipientPrintDecision(delivery?.address);
  const waybillId = delivery?.waybill ?? delivery?.shipments?.[0]?.waybillId ?? null;
  const waybillAction = dispatchWaybillAction(waybillId);
  const [printing, setPrinting] = useState(false);
  // ARGUS #282: the server rejects a short packaging plan until the operator
  // explicitly acknowledges it; the details come from the typed 409.
  const [shortfall, setShortfall] = useState<DispatchShortfallItem[] | null>(null);
  const [allowShortfall, setAllowShortfall] = useState(false);
  // ARGUS #283: null means "use the auto-deduct suggestion"; an array (even
  // empty) is the operator's explicit selection for this dispatch.
  const [selectedPackagingIds, setSelectedPackagingIds] = useState<string[] | null>(null);
  const {
    data: packagingOptions,
    isLoading: packagingLoading,
    isError: packagingError,
  } = usePackagingDispatchOptions(open);
  const options = packagingOptions ?? [];
  const selectedIds = selectedPackagingIds ?? suggestedPackagingItemIds(options);
  const selectionTotals = packagingSelectionTotals(options, selectedIds);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<z.input<typeof DispatchDeliverySchema>, unknown, z.output<typeof DispatchDeliverySchema>>({
    resolver: standardSchemaResolver(DispatchDeliverySchema),
    defaultValues: { waybillMode: 'AUTO', manualWaybillId: undefined },
  });

  const waybillMode = watch('waybillMode');

  useEffect(() => {
    if (open) {
      reset({ waybillMode: 'AUTO', manualWaybillId: undefined });
      setShortfall(null);
      setAllowShortfall(false);
      setSelectedPackagingIds(null);
    }
  }, [open, reset]);

  const onSubmit = (data: z.output<typeof DispatchDeliverySchema>) => {
    if (!delivery) return;
    dispatch.mutate(
      {
        id: delivery.id,
        data: {
          waybillMode: data.waybillMode,
          ...(data.waybillMode === 'MANUAL' && data.manualWaybillId
            ? { manualWaybillId: data.manualWaybillId }
            : {}),
          ...(packagingOptions !== undefined ? { packagingItemIds: selectedIds } : {}),
          ...(allowShortfall ? { allowPackagingShortfall: true } : {}),
        },
      },
      {
        onSuccess: onClose,
        onError: (error: Error) => {
          if (error instanceof DispatchRequestError && error.code === 'PACKAGING_SHORTFALL') {
            const details = error.details as { items?: DispatchShortfallItem[] } | null;
            setShortfall(details?.items ?? []);
            setAllowShortfall(false);
          }
        },
      },
    );
  };

  const handlePrintWaybill = async () => {
    if (!delivery) return;
    if (!canPrintWaybillNow) {
      toast.error(
        templateState === 'error'
          ? 'Waybill template failed to load - retry from Waybill Design before printing'
          : 'Waybill template is still loading',
      );
      return;
    }
    if (!recipientDecision.canPrint) {
      toast.error(recipientDecision.reason ?? 'Recipient address is incomplete');
      return;
    }
    setPrinting(true);
    try {
      printShippingLabel(delivery, waybillTemplate);
      await waitForPrintOverlayToClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Printing failed');
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">Dispatch Delivery</SheetTitle>
          <SheetDescription>
            {delivery ? `Dispatch ${delivery.orderRef ?? ''} to the courier.` : 'Dispatch delivery to the courier.'}
          </SheetDescription>
        </SheetHeader>

        {delivery && (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
            {/* ARGUS #278: show the collection context before dispatch. */}
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-mist/60 bg-linen/40 px-3 py-2.5 text-sm">
              <div>
                <p className="text-xs text-espresso/50">COD to collect</p>
                <p className="font-medium text-espresso">
                  {formatRupee(collectableCodAmount(delivery).toNumber())}
                </p>
              </div>
              <div>
                <p className="text-xs text-espresso/50">Shipping fee</p>
                <p className="font-medium text-espresso">
                  {delivery.shippingFee != null ? formatRupee(delivery.shippingFee) : '-'}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-espresso/50">Payment</p>
                <p className="font-medium text-espresso">
                  {describePayment(delivery.paymentMethod, delivery.paymentStatus)}
                </p>
              </div>
            </div>

            {waybillAction.hint && (
              <p
                role="note"
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                data-testid="dispatch-waybill-preview-hint"
              >
                {waybillAction.hint}
              </p>
            )}

            {senderDecision.missing.length > 0 && (
              <p
                role="alert"
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
              >
                {senderDecision.reason}. Update the Store Profile before printing.
              </p>
            )}
            {!recipientDecision.canPrint && (
              <p
                role="alert"
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
              >
                Waybill printing is blocked - {recipientDecision.reason}.
              </p>
            )}
            {/* Waybill Mode */}
            <div className="space-y-1.5">
              <Label>Waybill Mode</Label>
              <Select
                value={waybillMode ?? ''}
                onValueChange={(v) => setValue('waybillMode', v as 'AUTO' | 'MANUAL')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUTO">Auto-generate waybill</SelectItem>
                  <SelectItem value="MANUAL">Enter manual waybill</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {waybillMode === 'MANUAL' && (
              <div className="space-y-1.5">
                <Label htmlFor="manualWaybillId">Manual Waybill ID *</Label>
                <Input
                  id="manualWaybillId"
                  {...register('manualWaybillId')}
                  placeholder="e.g. TE-12345678"
                />
                {errors.manualWaybillId && (
                  <p className="text-sm text-terracotta">{errors.manualWaybillId.message}</p>
                )}
              </div>
            )}

            {/* ARGUS #283: explicit packaging selection for this parcel. */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Packaging for this parcel</Label>
                <span className="text-espresso/50 text-xs">
                  {selectionTotals.selectedCount} selected, {selectionTotals.unitsPerParcel} unit
                  {selectionTotals.unitsPerParcel === 1 ? '' : 's'} per parcel
                </span>
              </div>
              <p className="text-espresso/50 text-xs">
                Auto-deduct items are preselected. Uncheck anything this delivery does not use.
              </p>
              {packagingLoading ? (
                <p className="text-espresso/50 text-xs">Loading packaging items...</p>
              ) : packagingError ? (
                <p className="text-terracotta text-xs">
                  Could not load packaging items. Dispatch will use the auto-deduct defaults.
                </p>
              ) : options.length === 0 ? (
                <p className="text-espresso/50 text-xs">No packaging items are configured.</p>
              ) : (
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-sand p-2">
                  {options.map((option) => (
                    <label
                      key={option.id}
                      className="hover:bg-espresso/5 flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-sm"
                    >
                      <Checkbox
                        checked={selectedIds.includes(option.id)}
                        onCheckedChange={() => {
                          setSelectedPackagingIds(
                            togglePackagingItemId(selectedIds, option.id, options),
                          );
                          setShortfall(null);
                          setAllowShortfall(false);
                        }}
                        aria-label={`Use ${option.name} for this parcel`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-espresso block truncate">{option.name}</span>
                        <span className="text-espresso/50 block text-xs">
                          {formatPackagingQuantity(option.quantityOnHand, option.unit)} on hand,
                          {' '}
                          {Number(option.consumptionPerParcel ?? 1)} per parcel
                          {option.autoDeduct ? ' (auto)' : ''}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {shortfall && shortfall.length > 0 && (
              <div
                role="alert"
                className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
              >
                <p className="font-medium">Not enough packaging stock for this dispatch</p>
                <ul className="mt-2 space-y-1 text-xs">
                  {shortfall.map((item) => (
                    <li key={item.name}>
                      {item.name}: need {item.requiredUnits}, have {item.availableUnits}
                    </li>
                  ))}
                </ul>
                <label className="mt-3 flex items-start gap-2 text-xs">
                  <Checkbox
                    checked={allowShortfall}
                    onCheckedChange={(checked) => setAllowShortfall(checked === true)}
                    aria-label="Dispatch anyway with short packaging stock"
                  />
                  <span>
                    Dispatch anyway with short packaging stock. The available units are deducted
                    and the shortage is flagged as low stock.
                  </span>
                </label>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => void handlePrintWaybill()}
                disabled={
                  printing || dispatch.isPending || !canPrintWaybillNow || !recipientDecision.canPrint
                }
                aria-busy={printing}
                title={
                  waybillAction.hint ??
                  (!canPrintWaybillNow
                    ? templateState === 'ready'
                      ? senderDecision.reason ?? 'Sender details are incomplete'
                      : templateState === 'error'
                        ? 'Waybill template failed to load'
                        : 'Waybill template is still loading'
                    : recipientDecision.reason ?? undefined)
                }
                data-testid="dispatch-waybill-button"
              >
                {printing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" data-testid="loading-spinner" />
                ) : null}
                {printing ? 'Preparing waybill…' : waybillAction.label}
              </Button>
              <Button
                type="submit"
                disabled={dispatch.isPending || printing}
                aria-busy={dispatch.isPending}
                data-testid="dispatch-confirm-button"
              >
                {dispatch.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" data-testid="loading-spinner" />
                ) : null}
                {dispatch.isPending ? 'Dispatching…' : 'Dispatch'}
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
