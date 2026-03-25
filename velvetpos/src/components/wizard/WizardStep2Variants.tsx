'use client';

import { useState, useCallback, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useProductWizardStore } from '@/stores/productWizardStore';
import { SizeChipInput } from './SizeChipInput';
import { ColourChipInput } from './ColourChipInput';
import { VariantMatrixTable } from './VariantMatrixTable';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react';

interface VariantRow {
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
}

export interface VariantFormData {
  variants: VariantRow[];
}

function generateSku(productName: string, size: string, colour: string): string {
  const nameCode = productName.replace(/\s/g, '').slice(0, 3).toUpperCase() || 'PRD';
  const sizeCode = size.replace(/\s/g, '').toUpperCase() || 'OS';
  const colourCode = colour.replace(/\s/g, '').slice(0, 4).toUpperCase() || 'UNI';
  return `${nameCode}-${sizeCode}-${colourCode}`;
}

function deduplicateSkus(variants: VariantRow[]): VariantRow[] {
  const seen = new Map<string, number>();
  return variants.map((v) => {
    const baseSku = v.sku;
    const count = seen.get(baseSku) || 0;
    seen.set(baseSku, count + 1);
    if (count > 0) {
      return { ...v, sku: `${baseSku}-${String(count + 1).padStart(2, '0')}` };
    }
    return v;
  });
}

function generateMatrix(
  sizes: string[],
  colours: string[],
  productName: string,
  existing: VariantRow[],
): VariantRow[] {
  const existingMap = new Map(existing.map((v) => [v.combinationKey, v]));

  const effectiveSizes = sizes.length > 0 ? sizes : [''];
  const effectiveColours = colours.length > 0 ? colours : [''];

  const rows: VariantRow[] = [];
  for (const size of effectiveSizes) {
    for (const colour of effectiveColours) {
      const key = `${size}|${colour}`;
      const prev = existingMap.get(key);
      if (prev) {
        rows.push(prev);
      } else {
        rows.push({
          combinationKey: key,
          size,
          colour,
          sku: generateSku(productName, size, colour),
          costPrice: '',
          retailPrice: '',
          wholesalePrice: '',
          lowStockThreshold: 5,
          selected: true,
          imageUrls: [],
        });
      }
    }
  }
  return deduplicateSkus(rows);
}

export function WizardStep2Variants() {
  const step1Data = useProductWizardStore((s) => s.step1Data);
  const step2Data = useProductWizardStore((s) => s.step2Data);
  const goToStep = useProductWizardStore((s) => s.goToStep);
  const setStep2Data = useProductWizardStore((s) => s.setStep2Data);

  const productName = step1Data?.name ?? '';

  // Restore sizes/colours from step2Data when navigating back
  const [sizes, setSizes] = useState<string[]>(() => {
    if (step2Data?.variants.length) {
      const unique = [...new Set(step2Data.variants.map((v) => v.size).filter(Boolean))] as string[];
      return unique;
    }
    return [];
  });

  const [colours, setColours] = useState<string[]>(() => {
    if (step2Data?.variants.length) {
      const unique = [...new Set(step2Data.variants.map((v) => v.colour).filter(Boolean))] as string[];
      return unique;
    }
    return [];
  });

  const [error, setError] = useState<string | null>(null);

  // Build initial variants from step2Data if available
  const initialVariants: VariantRow[] = step2Data?.variants.length
    ? step2Data.variants.map((v) => ({
        combinationKey: `${v.size ?? ''}|${v.colour ?? ''}`,
        size: v.size ?? '',
        colour: v.colour ?? '',
        sku: v.sku ?? generateSku(productName, v.size ?? '', v.colour ?? ''),
        costPrice: v.costPrice > 0 ? String(v.costPrice) : '',
        retailPrice: v.retailPrice > 0 ? String(v.retailPrice) : '',
        wholesalePrice: v.wholesalePrice ? String(v.wholesalePrice) : '',
        lowStockThreshold: v.lowStockThreshold,
        selected: true,        imageUrls: v.imageUrls ?? [],      }))
    : generateMatrix(sizes, colours, productName, []);

  const { control, register, handleSubmit, setValue, watch, getValues } =
    useForm<VariantFormData>({
      defaultValues: { variants: initialVariants },
    });

  const { fields, replace } = useFieldArray({
    control,
    name: 'variants',
  });

  // Regenerate matrix when sizes or colours change
  const handleSizesChange = useCallback(
    (newSizes: string[]) => {
      setSizes(newSizes);
      const currentVariants = getValues('variants');
      const matrix = generateMatrix(newSizes, colours, productName, currentVariants);
      replace(matrix);
    },
    [colours, productName, getValues, replace],
  );

  const handleColoursChange = useCallback(
    (newColours: string[]) => {
      setColours(newColours);
      const currentVariants = getValues('variants');
      const matrix = generateMatrix(sizes, newColours, productName, currentVariants);
      replace(matrix);
    },
    [sizes, productName, getValues, replace],
  );

  const onSubmit = (data: VariantFormData) => {
    setError(null);

    const selected = data.variants.filter((v) => v.selected);
    if (selected.length === 0) {
      setError('At least one variant must be selected.');
      return;
    }

    for (const v of selected) {
      const cost = parseFloat(v.costPrice);
      if (!cost || cost <= 0) {
        setError(`Variant ${v.sku || v.combinationKey} must have a cost price greater than 0.`);
        return;
      }
      const retail = parseFloat(v.retailPrice);
      if (!retail || retail < cost) {
        setError(`Variant ${v.sku || v.combinationKey} retail price must be ≥ cost price.`);
        return;
      }
    }

    setStep2Data({
      variants: selected.map((v) => {
        const variant: {
          costPrice: number;
          retailPrice: number;
          lowStockThreshold: number;
          size?: string;
          colour?: string;
          wholesalePrice?: number;
          sku?: string;
          imageUrls?: string[];
        } = {
          costPrice: parseFloat(v.costPrice),
          retailPrice: parseFloat(v.retailPrice),
          lowStockThreshold: v.lowStockThreshold,
          imageUrls: v.imageUrls ?? [],
        };
        if (v.size) variant.size = v.size;
        if (v.colour) variant.colour = v.colour;
        if (v.wholesalePrice) variant.wholesalePrice = parseFloat(v.wholesalePrice);
        if (v.sku) variant.sku = v.sku;
        return variant;
      }),
    });

    goToStep(3);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div>
        <h2 className="font-display text-xl text-espresso mb-1">
          Step 2: Variant Matrix
        </h2>
        <p className="text-sm text-mist font-body">
          Define sizes and colours, then configure pricing for each variant.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label className="font-body font-semibold text-espresso mb-2 block">
            Sizes
          </Label>
          <SizeChipInput value={sizes} onChange={handleSizesChange} />
        </div>
        <div>
          <Label className="font-body font-semibold text-espresso mb-2 block">
            Colours
          </Label>
          <ColourChipInput value={colours} onChange={handleColoursChange} />
        </div>
      </div>

      {fields.length > 0 && (
        <div className="border border-mist rounded-lg overflow-hidden">
          <VariantMatrixTable
            fields={fields as Array<VariantRow & { id: string }>}
            control={control}
            register={register}
            setValue={setValue}
            watch={watch}
          />
        </div>
      )}

      {fields.length === 0 && (
        <div className="text-center text-mist py-8 font-body text-sm">
          Add sizes or colours above to generate the variant matrix.
        </div>
      )}

      <div className="flex justify-between pt-4 border-t border-mist">
        <Button
          type="button"
          variant="outline"
          onClick={() => goToStep(1)}
          className="gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button type="submit" className="gap-1.5">
          Next: Review
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
