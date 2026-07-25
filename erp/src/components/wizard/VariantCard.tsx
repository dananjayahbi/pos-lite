'use client';

import type {
  Control,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Wand2, AlertTriangle, ImageIcon } from 'lucide-react';
import type { VariantFormData } from './WizardStep2Variants';
import {
  PRODUCT_FORM_LABELS,
  PRODUCT_FORM_ICONS,
  type ProductFormValue,
} from '@/lib/constants/product-options';
import { VariantImagesUpload } from './VariantImagesUpload';

interface VariantCardProps {
  index: number;
  canViewCost: boolean;
  register: UseFormRegister<VariantFormData>;
  setValue: UseFormSetValue<VariantFormData>;
  watch: UseFormWatch<VariantFormData>;
  control: Control<VariantFormData>;
}

function generateBarcode(): string {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

function getFormLabel(form: string): string {
  return PRODUCT_FORM_LABELS[form as ProductFormValue] ?? form;
}

function getFormKey(form: string): string {
  return Object.prototype.hasOwnProperty.call(PRODUCT_FORM_ICONS, form)
    ? (form as ProductFormValue)
    : '';
}

/**
 * Single-variant card. Replaces a row in the dense matrix table.
 *
 * Layout:
 *   • Header — Form icon + label, pack size, enable/disable checkbox
 *   • Identity — SKU + barcode (with auto-generate)
 *   • Pricing — initial stock, cost, retail, wholesale, low-stock threshold
 *   • Images — up to 10 images with primary/remove controls
 */
export function VariantCard({
  index,
  canViewCost,
  register,
  setValue,
  watch,
}: VariantCardProps) {
  const selected = watch(`variants.${index}.selected`);
  const form = watch(`variants.${index}.form`);
  const packSize = watch(`variants.${index}.packSize`);
  const combinationKey = watch(`variants.${index}.combinationKey`);
  const costPrice = watch(`variants.${index}.costPrice`);
  const retailPrice = watch(`variants.${index}.retailPrice`);

  const costNum = parseFloat(costPrice) || 0;
  const retailNum = parseFloat(retailPrice) || 0;
  const retailBelowCost =
    retailNum > 0 && costNum > 0 && retailNum < costNum;

  const formIconKey = getFormKey(form);

  return (
    <article
      className={`rounded-xl border bg-pearl transition-opacity ${
        selected ? 'border-sand' : 'border-sand/40 opacity-60'
      }`}
    >
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-sand/40 bg-linen px-4 py-3">
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) =>
            setValue(`variants.${index}.selected`, !!checked, {
              shouldDirty: true,
            })
          }
          aria-label="Include this variant"
        />

        <div className="flex min-w-0 flex-1 items-center gap-2">
          {formIconKey
            ? (() => {
                const FormIcon = PRODUCT_FORM_ICONS[formIconKey as ProductFormValue];
                return FormIcon ? (
                  <FormIcon className="h-4 w-4 shrink-0 text-espresso" />
                ) : (
                  <span className="h-4 w-4 shrink-0" />
                );
              })()
            : (
                <span className="h-4 w-4 shrink-0" />
              )}
          <h3 className="truncate font-body text-sm font-semibold text-espresso">
            {form ? getFormLabel(form) : 'Variant'}
            {packSize ? (
              <span className="ml-1 text-mist">· {packSize}</span>
            ) : null}
          </h3>
        </div>

        <span className="hidden text-xs text-mist sm:inline">
          {selected ? 'Included' : 'Skipped'}
        </span>
      </header>

      {/* Body */}
      <div className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
        {/* SKU */}
        <div className="space-y-1.5">
          <label
            htmlFor={`sku-${index}`}
            className="font-body text-xs font-medium text-espresso"
          >
            SKU
          </label>
          <Input
            id={`sku-${index}`}
            {...register(`variants.${index}.sku`)}
            className="font-mono text-sm"
          />
        </div>

        {/* Barcode */}
        <div className="space-y-1.5">
          <label
            htmlFor={`barcode-${index}`}
            className="font-body text-xs font-medium text-espresso"
          >
            Barcode
          </label>
          <div className="flex items-center gap-1">
            <Input
              id={`barcode-${index}`}
              {...register(`variants.${index}.barcode`)}
              className="flex-1 font-mono text-sm"
              placeholder="Optional"
            />
            <button
              type="button"
              title="Auto-generate barcode"
              onClick={() =>
                setValue(
                  `variants.${index}.barcode`,
                  generateBarcode(),
                  { shouldDirty: true },
                )
              }
              className="shrink-0 rounded border border-sand p-1.5 text-mist transition-colors hover:border-espresso hover:text-espresso"
              aria-label="Auto-generate barcode"
            >
              <Wand2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Initial Stock */}
        <div className="space-y-1.5">
          <label
            htmlFor={`stock-${index}`}
            className="font-body text-xs font-medium text-espresso"
          >
            Initial Stock
          </label>
          <Input
            id={`stock-${index}`}
            type="number"
            min="0"
            step="1"
            {...register(`variants.${index}.initialStock`)}
            className="text-right text-sm"
            placeholder="0"
          />
        </div>

        {/* Cost Price */}
        {canViewCost && (
          <div className="space-y-1.5">
            <label
              htmlFor={`cost-${index}`}
              className="font-body text-xs font-medium text-espresso"
            >
              Cost Price
            </label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-mist">Rs.</span>
              <Input
                id={`cost-${index}`}
                type="number"
                step="0.01"
                min="0"
                {...register(`variants.${index}.costPrice`)}
                className="text-right text-sm"
              />
            </div>
          </div>
        )}

        {/* Retail Price */}
        <div className="space-y-1.5">
          <label
            htmlFor={`retail-${index}`}
            className="font-body text-xs font-medium text-espresso"
          >
            Retail Price
          </label>
          <div className="flex items-center gap-1">
            <span className="text-xs text-mist">Rs.</span>
            <Input
              id={`retail-${index}`}
              type="number"
              step="0.01"
              min="0"
              {...register(`variants.${index}.retailPrice`)}
              className={`text-right text-sm ${
                retailBelowCost ? 'border-orange-400 ring-1 ring-orange-400' : ''
              }`}
            />
          </div>
          {retailBelowCost && (
            <p className="flex items-center gap-1 text-xs text-orange-500">
              <AlertTriangle className="h-3 w-3" />
              Retail is below cost
            </p>
          )}
        </div>

        {/* Wholesale Price */}
        <div className="space-y-1.5">
          <label
            htmlFor={`wholesale-${index}`}
            className="font-body text-xs font-medium text-espresso"
          >
            Wholesale Price
          </label>
          <div className="flex items-center gap-1">
            <span className="text-xs text-mist">Rs.</span>
            <Input
              id={`wholesale-${index}`}
              type="number"
              step="0.01"
              min="0"
              {...register(`variants.${index}.wholesalePrice`)}
              className="text-right text-sm"
            />
          </div>
        </div>

        {/* Low Stock Threshold */}
        <div className="space-y-1.5">
          <label
            htmlFor={`low-${index}`}
            className="font-body text-xs font-medium text-espresso"
          >
            Low Stock Alert
          </label>
          <Input
            id={`low-${index}`}
            type="number"
            min="0"
            step="1"
            {...register(`variants.${index}.lowStockThreshold`, {
              valueAsNumber: true,
            })}
            className="text-right text-sm"
          />
        </div>
      </div>

      {/* Images */}
      <div className="border-t border-sand/40 bg-linen px-4 py-3">
        <div className="mb-2 flex items-center gap-2">
          <ImageIcon className="h-3.5 w-3.5 text-mist" />
          <span className="font-body text-xs font-medium text-espresso">
            Images
          </span>
        </div>
        <VariantImagesUpload
          combinationKey={combinationKey}
          maxImages={10}
        />
      </div>
    </article>
  );
}