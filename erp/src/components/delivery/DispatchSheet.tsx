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
import { useDispatchDelivery, useLabelTemplate } from '@/hooks/delivery';
import { DispatchRequestError, type DispatchShortfallItem } from '@/hooks/delivery';
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
  const [printing, setPrinting] = useState(false);
  // ARGUS #282: the server rejects a short packaging plan until the operator
  // explicitly acknowledges it; the details come from the typed 409.
  const [shortfall, setShortfall] = useState<DispatchShortfallItem[] | null>(null);
  const [allowShortfall, setAllowShortfall] = useState(false);

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
    setPrinting(true);
    try {
      printShippingLabel(delivery, waybillTemplate);
      await waitForPrintOverlayToClose();
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
                disabled={printing || dispatch.isPending || !canPrintWaybillNow}
                aria-busy={printing}
                title={!canPrintWaybillNow ? 'Waybill template is not loaded' : undefined}
                data-testid="dispatch-waybill-button"
              >
                {printing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" data-testid="loading-spinner" />
                ) : null}
                {printing ? 'Preparing waybill…' : 'Waybill'}
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
