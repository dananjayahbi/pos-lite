'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Wand2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const variantCreateSchema = z
  .object({
    sku: z.string().max(50).optional(),
    barcode: z
      .string()
      .regex(/^[a-zA-Z0-9-]{8,20}$/, 'Barcode must be 8-20 alphanumeric characters')
      .optional()
      .or(z.literal('')),
    size: z.string().max(10).optional().or(z.literal('')),
    colour: z.string().max(50).optional().or(z.literal('')),
    costPrice: z.number().positive('Cost price must be positive'),
    retailPrice: z.number().positive('Retail price must be positive'),
    wholesalePrice: z.number().positive().optional().nullable(),
    lowStockThreshold: z.number().int().min(0, 'Must be 0 or greater'),
  })
  .refine((data) => data.retailPrice >= data.costPrice, {
    message: 'Retail price must be greater than or equal to cost price',
    path: ['retailPrice'],
  })
  .refine(
    (data) => {
      if (data.wholesalePrice == null) return true;
      return data.wholesalePrice >= data.costPrice && data.wholesalePrice <= data.retailPrice;
    },
    {
      message: 'Wholesale price must be between cost price and retail price',
      path: ['wholesalePrice'],
    },
  );

type VariantCreateFormData = z.infer<typeof variantCreateSchema>;

function generateBarcode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  const suffix = Array.from(arr, (value) => chars[value % chars.length]).join('');
  return `VLV${suffix}`;
}

export function VariantCreateSheet({
  isOpen,
  onClose,
  productId,
}: {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
}) {
  const queryClient = useQueryClient();
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<VariantCreateFormData>({
    resolver: standardSchemaResolver(variantCreateSchema),
    defaultValues: {
      sku: '',
      barcode: '',
      size: '',
      colour: '',
      lowStockThreshold: 5,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: VariantCreateFormData) => {
      const payload = {
        ...(data.sku ? { sku: data.sku } : {}),
        ...(data.barcode ? { barcode: data.barcode } : {}),
        ...(data.size ? { size: data.size } : {}),
        ...(data.colour ? { colour: data.colour } : {}),
        costPrice: data.costPrice,
        retailPrice: data.retailPrice,
        ...(data.wholesalePrice != null ? { wholesalePrice: data.wholesalePrice } : {}),
        lowStockThreshold: data.lowStockThreshold,
      };

      const res = await fetch(`/api/store/products/${productId}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([payload]),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? 'Failed to create variant');
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success('Variant created successfully');
      queryClient.invalidateQueries({ queryKey: ['product', productId] });
      reset();
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
      return;
    }
    reset();
    onClose();
  };

  const costPrice = watch('costPrice');
  const retailPrice = watch('retailPrice');
  const retailBelowCost =
    typeof costPrice === 'number' && typeof retailPrice === 'number' && retailPrice < costPrice;

  const onSubmit = handleSubmit((data: VariantCreateFormData) => mutation.mutate(data));

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent side="right" className="flex w-full flex-col sm:w-[480px] sm:max-w-[480px]" showCloseButton={false}>
        <SheetHeader className="border-b border-sand/30 px-6 py-4">
          <SheetTitle className="font-display text-lg text-espresso">Add Variant</SheetTitle>
          <SheetDescription className="font-body text-sm text-mist">
            Create a new size, colour, or pricing combination for this product.
          </SheetDescription>
        </SheetHeader>

        <form id="variant-create-form" onSubmit={onSubmit} className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="create-sku" className="font-body text-sm text-espresso">SKU</Label>
            <Input id="create-sku" className="font-mono" {...register('sku')} />
            {errors.sku && <p className="text-xs text-red-600">{errors.sku.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-barcode" className="font-body text-sm text-espresso">Barcode</Label>
            <div className="flex gap-2">
              <Input id="create-barcode" className="flex-1 font-mono" {...register('barcode')} />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0 border-sand text-mist hover:text-espresso"
                onClick={() => setValue('barcode', generateBarcode(), { shouldDirty: true, shouldValidate: true })}
                aria-label="Auto-generate barcode"
              >
                <Wand2 className="h-4 w-4" />
              </Button>
            </div>
            {errors.barcode && <p className="text-xs text-red-600">{errors.barcode.message}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-size" className="font-body text-sm text-espresso">Size</Label>
              <Input id="create-size" {...register('size')} />
              {errors.size && <p className="text-xs text-red-600">{errors.size.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-colour" className="font-body text-sm text-espresso">Colour</Label>
              <Input id="create-colour" {...register('colour')} />
              {errors.colour && <p className="text-xs text-red-600">{errors.colour.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-cost-price" className="font-body text-sm text-espresso">Cost Price</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-mist">Rs.</span>
              <Input
                id="create-cost-price"
                className="pl-10 text-right"
                type="number"
                step="0.01"
                {...register('costPrice', { valueAsNumber: true })}
              />
            </div>
            {errors.costPrice && <p className="text-xs text-red-600">{errors.costPrice.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-retail-price" className="font-body text-sm text-espresso">Retail Price</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-mist">Rs.</span>
              <Input
                id="create-retail-price"
                className={`pl-10 text-right ${retailBelowCost ? 'border-orange-400 ring-1 ring-orange-400' : ''}`}
                type="number"
                step="0.01"
                {...register('retailPrice', { valueAsNumber: true })}
              />
            </div>
            {retailBelowCost && (
              <p className="text-xs text-orange-500">Retail price is below cost price</p>
            )}
            {errors.retailPrice && <p className="text-xs text-red-600">{errors.retailPrice.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-wholesale-price" className="font-body text-sm text-espresso">Wholesale Price</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-mist">Rs.</span>
              <Input
                id="create-wholesale-price"
                className="pl-10 text-right"
                type="number"
                step="0.01"
                {...register('wholesalePrice', { valueAsNumber: true })}
              />
            </div>
            {errors.wholesalePrice && <p className="text-xs text-red-600">{errors.wholesalePrice.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-threshold" className="font-body text-sm text-espresso">Low Stock Threshold</Label>
            <Input
              id="create-threshold"
              type="number"
              min="0"
              {...register('lowStockThreshold', { valueAsNumber: true })}
            />
            {errors.lowStockThreshold && <p className="text-xs text-red-600">{errors.lowStockThreshold.message}</p>}
          </div>
        </form>

        <SheetFooter className="border-t border-sand/30 px-6 py-4">
          {showDiscardConfirm ? (
            <div className="flex w-full items-center justify-between gap-2 rounded-md bg-sand/20 px-3 py-2">
              <p className="text-xs font-body text-espresso">Discard this new variant draft?</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="border-sand text-espresso" onClick={() => setShowDiscardConfirm(false)}>
                  Keep Editing
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-red-600 text-white hover:bg-red-700"
                  onClick={() => {
                    setShowDiscardConfirm(false);
                    reset();
                    onClose();
                  }}
                >
                  Discard
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex w-full justify-end gap-3">
              <Button type="button" variant="outline" className="border-mist text-mist hover:text-espresso" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" form="variant-create-form" className="bg-espresso text-pearl hover:bg-espresso/90" disabled={mutation.isPending}>
                {mutation.isPending ? 'Creating…' : 'Create Variant'}
              </Button>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
