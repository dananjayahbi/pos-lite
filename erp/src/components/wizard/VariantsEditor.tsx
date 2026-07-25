'use client';

import { useState } from 'react';
import type {
  Control,
  UseFormRegister,
  UseFormSetValue,
} from 'react-hook-form';
import { Wand2, Layers } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { VariantCard } from './VariantCard';
import type { VariantFormData } from './WizardStep2Variants';

interface VariantsEditorProps {
  fields: Array<VariantFormData['variants'][number] & { id: string }>;
  control: Control<VariantFormData>;
  register: UseFormRegister<VariantFormData>;
  setValue: UseFormSetValue<VariantFormData>;
  watch: import('react-hook-form').UseFormWatch<VariantFormData>;
  canViewCost: boolean;
}

/**
 * Container for the variant list. Each variant is rendered as its own card
 * (see `VariantCard`) so the pricing/image fields are easy to scan. An
 * "Apply to all" helper at the top bulk-sets cost / retail prices.
 */
export function VariantsEditor({
  fields,
  control,
  register,
  setValue,
  watch,
  canViewCost,
}: VariantsEditorProps) {
  const [bulkCost, setBulkCost] = useState('');
  const [bulkRetail, setBulkRetail] = useState('');

  function applyBulk() {
    if (!bulkCost && !bulkRetail) return;
    for (let i = 0; i < fields.length; i++) {
      if (bulkCost) {
        setValue(`variants.${i}.costPrice`, bulkCost, { shouldDirty: true });
      }
      if (bulkRetail) {
        setValue(`variants.${i}.retailPrice`, bulkRetail, {
          shouldDirty: true,
        });
      }
    }
  }

  const bulkReady = bulkCost !== '' || bulkRetail !== '';

  return (
    <div className="space-y-4">
      {/* Bulk pricing helper */}
      <div className="rounded-xl border border-sand/40 bg-linen px-4 py-3">
        <div className="mb-2 flex items-center gap-2 text-espresso">
          <Layers className="h-3.5 w-3.5" />
          <h4 className="font-body text-xs font-semibold uppercase tracking-wide">
            Bulk price apply
          </h4>
        </div>
        <p className="mb-3 text-xs text-mist font-body">
          Set the same cost or retail price across every variant. Leave a field
          empty to skip it.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          {canViewCost && (
            <div className="space-y-1">
              <label className="font-body text-[10px] uppercase tracking-wide text-mist">
                Cost (Rs.)
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={bulkCost}
                onChange={(e) => setBulkCost(e.target.value)}
                className="h-8 w-28 text-right text-sm"
                placeholder="0.00"
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="font-body text-[10px] uppercase tracking-wide text-mist">
              Retail (Rs.)
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={bulkRetail}
              onChange={(e) => setBulkRetail(e.target.value)}
              className="h-8 w-28 text-right text-sm"
              placeholder="0.00"
            />
          </div>
          <Button
            type="button"
            onClick={applyBulk}
            disabled={!bulkReady}
            size="sm"
            className="h-8 gap-1.5 bg-espresso text-pearl hover:bg-espresso/90 disabled:bg-espresso/40"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Apply to All
          </Button>
        </div>
      </div>

      {/* Variant cards */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {fields.map((field, index) => (
          <VariantCard
            key={field.id}
            index={index}
            canViewCost={canViewCost}
            register={register}
            setValue={setValue}
            watch={watch}
            control={control}
          />
        ))}
      </div>
    </div>
  );
}