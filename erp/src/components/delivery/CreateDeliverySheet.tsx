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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CreateDeliverySchema,
} from '@/lib/validators/delivery.validators';
import { useCreateDelivery, useLocations, useRatePreview } from '@/hooks/delivery';
import { useDeliveryStore } from '@/stores/deliveryStore';
import { formatRupee } from '@/lib/format';

interface CreateDeliverySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateDeliverySheet({ open, onOpenChange }: CreateDeliverySheetProps) {
  const closeCreate = useDeliveryStore((s) => s.closeCreate);
  const createDelivery = useCreateDelivery();
  const locations = useLocations();
  const ratePreview = useRatePreview();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<z.input<typeof CreateDeliverySchema>, unknown, z.output<typeof CreateDeliverySchema>>({
    resolver: standardSchemaResolver(CreateDeliverySchema),
    defaultValues: {
      itemCount: 1,
      address: {
        fullName: '',
        phone: '',
        phone2: '',
        addressLine1: '',
        addressLine2: '',
        cityName: '',
      },
    },
  });

  const weight = watch('totalWeightKg') as number | undefined;
  const cityId = watch('address.cityId') as number | undefined;

  // Fetch a rate preview whenever the weight or destination city changes.
  useEffect(() => {
    if (!open) return;
    if (weight != null && weight > 0 && cityId) {
      ratePreview.mutate({ weightKg: weight, destinationCityId: cityId });
    }
  }, [open, weight, cityId]);

  const cities = (locations.data?.cities ?? []) as Array<{
    id: number;
    name: string;
    districtId?: number | null;
  }>;

  const onSubmit = (data: z.output<typeof CreateDeliverySchema>) => {
    createDelivery.mutate(data, { onSuccess: closeCreate });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">Create Delivery</SheetTitle>
          <SheetDescription>Create a manual delivery order.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          {/* Recipient */}
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Recipient Name *</Label>
            <Input id="fullName" {...register('address.fullName')} placeholder="Recipient name" />
            {errors.address?.fullName && (
              <p className="text-sm text-terracotta">{errors.address.fullName.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone *</Label>
              <Input id="phone" {...register('address.phone')} placeholder="+94XXXXXXXXX" />
              {errors.address?.phone && (
                <p className="text-sm text-terracotta">{errors.address.phone.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone2">Phone 2</Label>
              <Input id="phone2" {...register('address.phone2')} placeholder="Optional" />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label htmlFor="addressLine1">Address Line 1 *</Label>
            <Input
              id="addressLine1"
              {...register('address.addressLine1')}
              placeholder="Street address"
            />
            {errors.address?.addressLine1 && (
              <p className="text-sm text-terracotta">{errors.address.addressLine1.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="addressLine2">Address Line 2</Label>
            <Input id="addressLine2" {...register('address.addressLine2')} placeholder="Optional" />
          </div>

          {/* City */}
          <div className="space-y-1.5">
            <Label>City *</Label>
            <Select
              value={cityId != null ? String(cityId) : ''}
              onValueChange={(v) => {
                const city = cities.find((c) => String(c.id) === v);
                setValue('address.cityId', Number(v));
                setValue('address.cityName', city?.name ?? '');
                if (city?.districtId) setValue('address.districtId', city.districtId);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={locations.isLoading ? 'Loading cities...' : 'Select city'} />
              </SelectTrigger>
              <SelectContent>
                {cities.map((city) => (
                  <SelectItem key={city.id} value={String(city.id)}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.address?.cityName && (
              <p className="text-sm text-terracotta">{errors.address.cityName.message}</p>
            )}
          </div>

          {/* COD */}
          <div className="space-y-1.5">
            <Label htmlFor="codAmount">COD Amount</Label>
            <Input id="codAmount" type="number" step="0.01" {...register('codAmount')} placeholder="0.00" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="itemCount">Item Count</Label>
              <Input id="itemCount" type="number" {...register('itemCount')} />
              {errors.itemCount && (
                <p className="text-sm text-terracotta">{errors.itemCount.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="totalWeightKg">Total Weight (kg)</Label>
              <Input
                id="totalWeightKg"
                type="number"
                step="0.01"
                {...register('totalWeightKg')}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Rate preview */}
          {ratePreview.data && (
            <div className="rounded-lg border border-espresso/10 bg-espresso/5 px-3 py-2 text-sm">
              <span className="text-espresso/60">Estimated shipping fee: </span>
              <span className="font-medium text-espresso">
                {formatRupee(
                  ratePreview.data.shippingFee ??
                    ratePreview.data.total ??
                    ratePreview.data.rate ??
                    0,
                )}
              </span>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register('notes')}
              placeholder="Any additional notes..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createDelivery.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createDelivery.isPending}>
              {createDelivery.isPending ? 'Creating...' : 'Create Delivery'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
