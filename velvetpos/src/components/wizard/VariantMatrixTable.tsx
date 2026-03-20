'use client';

import { memo, useState } from 'react';
import type {
  Control,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
          className="font-mono text-xs h-7"
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
            className="text-right h-7 text-xs"
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
            className={`text-right h-7 text-xs ${retailBelowCost ? 'border-orange-500' : ''}`}
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
            className="text-right h-7 text-xs"
          />
        </div>
      </td>
      <td className="px-3 py-2">
        <Input
          {...register(`variants.${index}.lowStockThreshold`, { valueAsNumber: true })}
          type="number"
          min="0"
          className="text-right h-7 text-xs w-16"
        />
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
            <th className="px-3 py-2 text-left font-semibold text-espresso">SKU</th>
            <th className="px-3 py-2 text-left font-semibold text-espresso">Colour</th>
            <th className="px-3 py-2 text-left font-semibold text-espresso">Size</th>
            <th className="px-3 py-2 text-right font-semibold text-espresso">Cost Price</th>
            <th className="px-3 py-2 text-right font-semibold text-espresso">Retail Price</th>
            <th className="px-3 py-2 text-right font-semibold text-espresso">Wholesale Price</th>
            <th className="px-3 py-2 text-right font-semibold text-espresso">Low Stock</th>
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
                  className="text-right h-7 text-xs"
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
                  className="text-right h-7 text-xs"
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
