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
  const [printing, setPrinting] = useState(false);

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
    if (open) reset({ waybillMode: 'AUTO', manualWaybillId: undefined });
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
        },
      },
      { onSuccess: onClose },
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
                  !canPrintWaybillNow
                    ? templateState === 'ready'
                      ? senderDecision.reason ?? 'Sender details are incomplete'
                      : templateState === 'error'
                        ? 'Waybill template failed to load'
                        : 'Waybill template is still loading'
                    : recipientDecision.reason ?? undefined
                }
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
