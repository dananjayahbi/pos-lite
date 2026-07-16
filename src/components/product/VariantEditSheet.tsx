'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wand2 } from 'lucide-react';
import { ProductImageUpload } from '@/components/product/ProductImageUpload';
import { SizePickerPanel } from '@/components/product/SizePickerPanel';
import {
  variantEditSchema,
  type VariantEditFormData,
} from '@/lib/validators/variant-edit.validators';
import { useVariantMutation } from '@/hooks/useVariantMutation';

// ── Types ────────────────────────────────────────────────────────────────────

interface VariantData {
  id: string;
  sku: string;
  barcode: string | null;
  size: string | null;
  colour: string | null;
  costPrice: string | number;
  retailPrice: string | number;
  wholesalePrice: string | number | null;
  lowStockThreshold: number;
  stockQuantity: number;
  imageUrls: string[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  variant: VariantData | null;
  permissions: string[];
  productId: string;
}

// ── Barcode generator ────────────────────────────────────────────────────────

function generateBarcode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  const suffix = Array.from(arr, (b) => chars[b % chars.length]).join('');
  return `VLV${suffix}`;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toNum(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  const n = typeof val === 'string' ? parseFloat(val) : val;
  return isNaN(n) ? 0 : n;
}

// ── Component ────────────────────────────────────────────────────────────────

export function VariantEditSheet({
  isOpen,
  onClose,
  variant,
  permissions,
  productId,
}: Props) {
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const mutation = useVariantMutation();
  const canViewCost = permissions.includes('product:view_cost_price');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty, dirtyFields },
  } = useForm<VariantEditFormData>({
    resolver: standardSchemaResolver(variantEditSchema),
  });

  // Reset form when variant changes
  useEffect(() => {
    if (variant) {
      reset({
        sku: variant.sku,
        barcode: variant.barcode,
        size: variant.size ?? '',
        colour: variant.colour ?? '',
        costPrice: toNum(variant.costPrice),
        retailPrice: toNum(variant.retailPrice),
        wholesalePrice: variant.wholesalePrice != null ? toNum(variant.wholesalePrice) : null,
        lowStockThreshold: variant.lowStockThreshold,
        imageUrls: variant.imageUrls ?? [],
      });
    }
    setShowDiscardConfirm(false);
  }, [variant, reset]);

  const watchedImageUrls = watch('imageUrls') ?? variant?.imageUrls ?? [];
  const watchedRetail = watch('retailPrice');
  const watchedCost = watch('costPrice');
  const retailBelowCost =
    canViewCost &&
    typeof watchedRetail === 'number' &&
    typeof watchedCost === 'number' &&
    watchedRetail > 0 &&
    watchedRetail < watchedCost;

  const handleClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const handleDiscard = () => {
    setShowDiscardConfirm(false);
    onClose();
  };

  const onSubmit = (data: VariantEditFormData) => {
    if (!variant) return;
    const payload: Record<string, unknown> = {};
    const dirtyKeys = Object.keys(dirtyFields) as (keyof VariantEditFormData)[];
    for (const key of dirtyKeys) {
      payload[key] = data[key];
    }
    mutation.mutate(
      { productId, variantId: variant.id, data: payload },
      { onSuccess: () => onClose() },
    );
  };

  if (!variant) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent
        side="right"
        className="w-full sm:w-[480px] sm:max-w-[480px] flex flex-col"
        showCloseButton={false}
      >
        {/* Header */}
        <SheetHeader className="border-b border-sand/30 px-6 py-4">
          <SheetTitle className="font-display text-lg text-espresso">
            Edit Variant
          </SheetTitle>
          <SheetDescription className="font-mono text-xs text-mist">
            {variant.sku}
          </SheetDescription>
        </SheetHeader>

        {/* Body */}
        <form
          id="variant-edit-form"
          onSubmit={handleSubmit(onSubmit)}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
        >
          {/* SKU */}
          <div className="space-y-1.5">
            <Label htmlFor="sku" className="font-body text-sm text-espresso">
              SKU
            </Label>
            <Input
              id="sku"
              className="font-mono"
              {...register('sku')}
            />
            {errors.sku && (
              <p className="text-xs text-red-600">{errors.sku.message}</p>
            )}
          </div>

          {/* Barcode */}
          <div className="space-y-1.5">
            <Label htmlFor="barcode" className="font-body text-sm text-espresso">
              Barcode
            </Label>
            <div className="flex gap-2">
              <Input
                id="barcode"
                className="font-mono flex-1"
                {...register('barcode')}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="border-sand text-mist hover:text-espresso shrink-0"
                onClick={() => setValue('barcode', generateBarcode(), { shouldDirty: true })}
                title="Auto-generate barcode"
                aria-label="Auto-generate barcode"
              >
                <Wand2 className="h-4 w-4" />
              </Button>
            </div>
            {errors.barcode && (
              <p className="text-xs text-red-600">{errors.barcode.message}</p>
            )}
          </div>

          {/* Size */}
          <div className="space-y-1.5">
            <Label className="font-body text-sm text-espresso">
              Size
            </Label>
            <SizePickerPanel
              value={watch('size') ?? ''}
              onChange={(sz) => setValue('size', sz, { shouldDirty: true, shouldValidate: true })}
            />
            {errors.size && (
              <p className="text-xs text-red-600">{errors.size.message}</p>
            )}
          </div>

          {/* Colour */}
          <div className="space-y-1.5">
            <Label htmlFor="colour" className="font-body text-sm text-espresso">
              Colour
            </Label>
            <div className="relative">
              {watch('colour') && (
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border border-mist/40 shrink-0 pointer-events-none"
                  style={{ backgroundColor: watch('colour') ?? '' }}
                  aria-hidden="true"
                />
              )}
              <Input
                id="colour"
                className={watch('colour') ? 'pl-8' : ''}
                {...register('colour')}
              />
            </div>
            {errors.colour && (
              <p className="text-xs text-red-600">{errors.colour.message}</p>
            )}
          </div>

          {/* Cost Price */}
          {canViewCost && (
            <div className="space-y-1.5">
              <Label htmlFor="costPrice" className="font-body text-sm text-espresso">
                Cost Price
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-mist">
                  Rs.
                </span>
                <Input
                  id="costPrice"
                  className="pl-10 text-right"
                  type="number"
                  step="0.01"
                  {...register('costPrice', { valueAsNumber: true })}
                />
              </div>
              {errors.costPrice && (
                <p className="text-xs text-red-600">{errors.costPrice.message}</p>
              )}
            </div>
          )}

          {/* Retail Price */}
          <div className="space-y-1.5">
            <Label htmlFor="retailPrice" className="font-body text-sm text-espresso">
              Retail Price
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-mist">
                Rs.
              </span>
              <Input
                id="retailPrice"
                className={`pl-10 text-right ${retailBelowCost ? 'border-orange-400 ring-1 ring-orange-400' : ''}`}
                type="number"
                step="0.01"
                {...register('retailPrice', { valueAsNumber: true })}
              />
            </div>
            {retailBelowCost && (
              <p className="text-xs text-orange-500">
                Retail price is below cost price
              </p>
            )}
            {errors.retailPrice && (
              <p className="text-xs text-red-600">{errors.retailPrice.message}</p>
            )}
          </div>

          {/* Wholesale Price */}
          <div className="space-y-1.5">
            <Label htmlFor="wholesalePrice" className="font-body text-sm text-espresso">
              Wholesale Price
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-mist">
                Rs.
              </span>
              <Input
                id="wholesalePrice"
                className="pl-10 text-right"
                type="number"
                step="0.01"
                {...register('wholesalePrice', { valueAsNumber: true })}
              />
            </div>
            {errors.wholesalePrice && (
              <p className="text-xs text-red-600">{errors.wholesalePrice.message}</p>
            )}
          </div>

          {/* Low Stock Threshold */}
          <div className="space-y-1.5">
            <Label htmlFor="lowStockThreshold" className="font-body text-sm text-espresso">
              Low Stock Threshold
            </Label>
            <Input
              id="lowStockThreshold"
              type="number"
              min="0"
              {...register('lowStockThreshold', { valueAsNumber: true })}
            />
            {errors.lowStockThreshold && (
              <p className="text-xs text-red-600">{errors.lowStockThreshold.message}</p>
            )}
          </div>

          {/* Images */}
          <div className="space-y-1.5">
            <Label className="font-body text-sm text-espresso">Images</Label>
            <ProductImageUpload
              imageUrls={watchedImageUrls}
              onImagesChange={(urls) => setValue('imageUrls', urls, { shouldDirty: true })}
              maxImages={5}
            />
          </div>
        </form>

        {/* Footer */}
        <SheetFooter className="border-t border-sand/30 px-6 py-4">
          {showDiscardConfirm ? (
            <div className="flex w-full items-center justify-between gap-2 rounded-md bg-sand/20 px-3 py-2">
              <p className="text-xs text-espresso font-body">
                Discard unsaved changes?
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-sand text-espresso"
                  onClick={() => setShowDiscardConfirm(false)}
                >
                  Keep Editing
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-red-600 text-white hover:bg-red-700"
                  onClick={handleDiscard}
                >
                  Discard
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex w-full justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                className="border-mist text-mist hover:text-espresso"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="variant-edit-form"
                className="bg-espresso text-pearl hover:bg-espresso/90"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? 'Saving…' : 'Save Changes'}
              </Button>
            </div>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
