'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
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
import { DEFAULT_LABEL_TEMPLATE } from '@/lib/constants/label';
import { printShippingLabel } from './labels/ShippingLabel';
import type { DeliveryListItem } from '@/types/delivery';

interface DispatchSheetProps {
  delivery: DeliveryListItem | null;
  open: boolean;
  onClose: () => void;
}

export function DispatchSheet({ delivery, open, onClose }: DispatchSheetProps) {
  const dispatch = useDispatchDelivery();
  const { data: labelTemplate } = useLabelTemplate();

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

            <div className="flex flex-wrap justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => printShippingLabel(delivery, labelTemplate ?? DEFAULT_LABEL_TEMPLATE)}
              >
                Print Label
              </Button>
              <Button type="submit" disabled={dispatch.isPending}>
                {dispatch.isPending ? 'Dispatching...' : 'Dispatch'}
              </Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
