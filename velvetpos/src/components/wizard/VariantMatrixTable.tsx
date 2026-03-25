'use client';

import { memo, useState, useRef } from 'react';
import type {
  Control,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ImageOff, Plus, X, Loader2 } from 'lucide-react';
import Image from 'next/image';
import type { VariantFormData } from './WizardStep2Variants';

interface VariantMatrixTableProps {
  fields: Array<{
    id: string;
    combinationKey: string;
    size: string;
    colour: string;
    sku: string;
    costPrice: string;
    retailPrice: string;
    wholesalePrice: string;
    lowStockThreshold: number;
    selected: boolean;
    imageUrls: string[];
  }>;
  control: Control<VariantFormData>;
  register: UseFormRegister<VariantFormData>;
  setValue: UseFormSetValue<VariantFormData>;
  watch: UseFormWatch<VariantFormData>;
}

interface VariantMatrixRowProps {
  index: number;
  register: UseFormRegister<VariantFormData>;
  setValue: UseFormSetValue<VariantFormData>;
  watch: UseFormWatch<VariantFormData>;
}

const VariantMatrixRow = memo(function VariantMatrixRow({
  index,
  register,
  setValue,
  watch,
}: VariantMatrixRowProps) {
  const selected = watch(`variants.${index}.selected`);
  const size = watch(`variants.${index}.size`);
  const colour = watch(`variants.${index}.colour`);
  const costPrice = watch(`variants.${index}.costPrice`);
  const retailPrice = watch(`variants.${index}.retailPrice`);
  const imageUrls: string[] = (watch(`variants.${index}.imageUrls`) as string[] | undefined) ?? [];

  const [uploading, setUploading] = useState(false);
  const [brokenUrls, setBrokenUrls] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) return;
    if (file.size > 5 * 1024 * 1024) return;
    const formData = new FormData();
    formData.append('image', file);
    const xhr = new XMLHttpRequest();
    xhr.onload = () => {
      setUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText) as { url: string };
        setValue(`variants.${index}.imageUrls`, [...imageUrls, data.url], { shouldDirty: true });
      }
    };
    xhr.onerror = () => setUploading(false);
    setUploading(true);
    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  }

  function removeImage(url: string) {
    setValue(`variants.${index}.imageUrls`, imageUrls.filter((u) => u !== url), { shouldDirty: true });
  }

  const costNum = parseFloat(costPrice) || 0;
  const retailNum = parseFloat(retailPrice) || 0;
  const retailBelowCost = retailNum > 0 && costNum > 0 && retailNum < costNum;

  return (
    <tr className={`bg-pearl hover:bg-terracotta/10 transition-colors ${!selected ? 'opacity-40' : ''}`}>
      <td className="px-3 py-2 text-center">
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) =>
            setValue(`variants.${index}.selected`, !!checked, { shouldDirty: true })
          }
        />
      </td>
      <td className="px-3 py-2">
        <Input
          {...register(`variants.${index}.sku`)}
          className="font-mono text-xs h-7 min-w-[120px]"
        />
      </td>
      <td className="px-3 py-2">
        {colour && (
          <span className="inline-flex items-center gap-1.5 text-xs font-body">
            <span
              className="inline-block h-3 w-3 rounded-full border border-espresso/20 shrink-0"
              style={{ backgroundColor: colour }}
              aria-hidden="true"
            />
            {colour}
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-xs font-body">{size}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-mist shrink-0">Rs.</span>
          <Input
            {...register(`variants.${index}.costPrice`)}
            type="number"
            step="0.01"
            min="0"
            className="text-right h-7 text-xs min-w-[100px]"
          />
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-mist shrink-0">Rs.</span>
          <Input
            {...register(`variants.${index}.retailPrice`)}
            type="number"
            step="0.01"
            min="0"
            className={`text-right h-7 text-xs min-w-[100px] ${retailBelowCost ? 'border-orange-500' : ''}`}
          />
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-mist shrink-0">Rs.</span>
          <Input
            {...register(`variants.${index}.wholesalePrice`)}
            type="number"
            step="0.01"
            min="0"
            className="text-right h-7 text-xs min-w-[100px]"
          />
        </div>
      </td>
      <td className="px-3 py-2">
        <Input
          {...register(`variants.${index}.lowStockThreshold`, { valueAsNumber: true })}
          type="number"
          min="0"
          className="text-right h-7 text-xs w-20"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          {imageUrls.map((url) => (
            <div key={url} className="relative group h-8 w-8 shrink-0 rounded border border-sand/30 overflow-hidden">
              {brokenUrls.has(url) ? (
                <div className="flex h-full w-full items-center justify-center bg-sand/20">
                  <ImageOff className="h-3 w-3 text-mist" />
                </div>
              ) : (
                <Image
                  src={url}
                  alt=""
                  fill
                  className="object-cover"
                  onError={() => setBrokenUrls((prev) => new Set(prev).add(url))}
                />
              )}
              <button
                type="button"
                onClick={() => removeImage(url)}
                className="absolute inset-0 flex items-center justify-center bg-espresso/60 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-2.5 w-2.5 text-pearl" />
              </button>
            </div>
          ))}
          {imageUrls.length < 3 && (
            uploading ? (
              <div className="flex h-8 w-8 items-center justify-center rounded border border-sand/30 bg-linen">
                <Loader2 className="h-3 w-3 animate-spin text-mist" />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded border-2 border-dashed border-sand bg-linen hover:border-terracotta hover:bg-terracotta/5 transition-colors"
              >
                <Plus className="h-3 w-3 text-terracotta" />
              </button>
            )
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
          />
        </div>
      </td>
    </tr>
  );
});

export function VariantMatrixTable({
  fields,
  control: _control,
  register,
  setValue,
  watch,
}: VariantMatrixTableProps) {
  const [applyCost, setApplyCost] = useState('');
  const [applyRetail, setApplyRetail] = useState('');

  const handleApplyAll = () => {
    for (let i = 0; i < fields.length; i++) {
      if (applyCost) setValue(`variants.${i}.costPrice`, applyCost, { shouldDirty: true });
      if (applyRetail) setValue(`variants.${i}.retailPrice`, applyRetail, { shouldDirty: true });
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm font-body border-collapse">
        <thead>
          <tr className="bg-sand/30">
            <th className="px-3 py-2 text-left font-semibold text-espresso w-10" />
            <th className="px-3 py-2 text-left font-semibold text-espresso min-w-[140px]">SKU</th>
            <th className="px-3 py-2 text-left font-semibold text-espresso min-w-[110px]">Colour</th>
            <th className="px-3 py-2 text-left font-semibold text-espresso min-w-[80px]">Size</th>
            <th className="px-3 py-2 text-right font-semibold text-espresso min-w-[140px]">Cost Price</th>
            <th className="px-3 py-2 text-right font-semibold text-espresso min-w-[140px]">Retail Price</th>
            <th className="px-3 py-2 text-right font-semibold text-espresso min-w-[150px]">Wholesale Price</th>
            <th className="px-3 py-2 text-right font-semibold text-espresso min-w-[90px]">Low Stock</th>
            <th className="px-3 py-2 text-left font-semibold text-espresso min-w-[120px]">Images</th>
          </tr>
        </thead>
        <tbody>
          {/* Apply to all row */}
          <tr className="bg-linen border-t border-sand">
            <td className="px-3 py-2" />
            <td colSpan={3} className="px-3 py-2">
              <span className="text-xs italic text-mist">Apply to all variants</span>
            </td>
            <td className="px-3 py-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-mist shrink-0">Rs.</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={applyCost}
                  onChange={(e) => setApplyCost(e.target.value)}
                  className="text-right h-7 text-xs min-w-[100px]"
                  placeholder="Cost"
                />
              </div>
            </td>
            <td className="px-3 py-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-mist shrink-0">Rs.</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={applyRetail}
                  onChange={(e) => setApplyRetail(e.target.value)}
                  className="text-right h-7 text-xs min-w-[100px]"
                  placeholder="Retail"
                />
              </div>
            </td>
            <td className="px-3 py-2" />
            <td className="px-3 py-2">
              <button
                type="button"
                onClick={handleApplyAll}
                className="border border-sand text-espresso hover:bg-sand/20 rounded-full px-3 py-1 text-xs font-body transition-colors whitespace-nowrap"
              >
                Apply to All
              </button>
            </td>
            <td className="px-3 py-2" />
          </tr>
          {/* Data rows */}
          {fields.map((field, index) => (
            <VariantMatrixRow
              key={field.id}
              index={index}
              register={register}
              setValue={setValue}
              watch={watch}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
