'use client';

import { useState, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useProductWizardStore } from '@/stores/productWizardStore';
import { PackSizeChipInput } from './PackSizeChipInput';
import { FormChipInput } from './FormChipInput';
import { VariantMatrixTable } from './VariantMatrixTable';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react';

interface VariantRow {
  combinationKey: string;
  form: string;
  packSize: string;
  sku: string;
  barcode: string;
  initialStock: string;
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

/**
 * Generates a deterministic SKU from a (form, packSize) combination.
 *
 * Format: `NAME-FORM-PACKSIZE` (uppercase, no spaces) — e.g. `ASH-POW-100G`.
 */
function generateSku(
  productName: string,
  form: string,
  packSize: string,
): string {
  const nameCode =
    productName.replace(/\s/g, '').slice(0, 3).toUpperCase() || 'PRD';
  const formCode = form.replace(/\s/g, '').slice(0, 4).toUpperCase() || 'UNI';
  const packCode = packSize.replace(/\s/g, '').slice(0, 4).toUpperCase() || 'OS';
  return `${nameCode}-${formCode}-${packCode}`;
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
  forms: string[],
  packSizes: string[],
  productName: string,
  existing: VariantRow[],
): VariantRow[] {
  const existingMap = new Map(existing.map((v) => [v.combinationKey, v]));

  const effectiveForms = forms.length > 0 ? forms : [''];
  const effectivePackSizes = packSizes.length > 0 ? packSizes : [''];

  const rows: VariantRow[] = [];
  for (const form of effectiveForms) {
    for (const packSize of effectivePackSizes) {
      const key = `${form}|${packSize}`;
      const prev = existingMap.get(key);
      if (prev) {
        rows.push(prev);
      } else {
        rows.push({
          combinationKey: key,
          form,
          packSize,
          sku: generateSku(productName, form, packSize),
          barcode: '',
          initialStock: '',
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

  const [forms, setForms] = useState<string[]>(() => {
    if (step2Data?.variants.length) {
      const unique = [
        ...new Set(step2Data.variants.map((v) => v.form).filter(Boolean)),
      ] as string[];
      return unique;
    }
    return [];
  });

  const [packSizes, setPackSizes] = useState<string[]>(() => {
    if (step2Data?.variants.length) {
      const unique = [
        ...new Set(step2Data.variants.map((v) => v.packSize).filter(Boolean)),
      ] as string[];
      return unique;
    }
    return [];
  });

  const [error, setError] = useState<string | null>(null);

  const initialVariants: VariantRow[] = step2Data?.variants.length
    ? step2Data.variants.map((v) => ({
        combinationKey: `${v.form ?? ''}|${v.packSize ?? ''}`,
        form: v.form ?? '',
        packSize: v.packSize ?? '',
        sku:
          v.sku ??
          generateSku(
            productName,
            v.form ?? '',
            v.packSize ?? '',
          ),
        barcode: v.barcode ?? '',
        initialStock: v.initialStock != null ? String(v.initialStock) : '',
        costPrice: v.costPrice > 0 ? String(v.costPrice) : '',
        retailPrice: v.retailPrice > 0 ? String(v.retailPrice) : '',
        wholesalePrice: v.wholesalePrice ? String(v.wholesalePrice) : '',
        lowStockThreshold: v.lowStockThreshold,
        selected: true,
        imageUrls: v.imageUrls ?? [],
      }))
    : generateMatrix(forms, packSizes, productName, []);

  const { control, register, handleSubmit, setValue, watch, getValues } =
    useForm<VariantFormData>({
      defaultValues: { variants: initialVariants },
    });

  const { fields, replace } = useFieldArray({
    control,
    name: 'variants',
  });

  const handleFormsChange = useCallback(
    (newForms: string[]) => {
      setForms(newForms);
      const currentVariants = getValues('variants');
      const matrix = generateMatrix(
        newForms,
        packSizes,
        productName,
        currentVariants,
      );
      replace(matrix);
    },
    [packSizes, productName, getValues, replace],
  );

  const handlePackSizesChange = useCallback(
    (newPackSizes: string[]) => {
      setPackSizes(newPackSizes);
      const currentVariants = getValues('variants');
      const matrix = generateMatrix(
        forms,
        newPackSizes,
        productName,
        currentVariants,
      );
      replace(matrix);
    },
    [forms, productName, getValues, replace],
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
        setError(
          `Variant ${v.sku || v.combinationKey} must have a cost price greater than 0.`,
        );
        return;
      }
      const retail = parseFloat(v.retailPrice);
      if (!retail || retail < cost) {
        setError(
          `Variant ${v.sku || v.combinationKey} retail price must be ≥ cost price.`,
        );
        return;
      }
    }

    setStep2Data({
      variants: selected.map((v) => {
        const variant: {
          costPrice: number;
          retailPrice: number;
          lowStockThreshold: number;
          form?: string;
          packSize?: string;
          wholesalePrice?: number;
          sku?: string;
          barcode?: string;
          initialStock?: number;
          imageUrls?: string[];
        } = {
          costPrice: parseFloat(v.costPrice),
          retailPrice: parseFloat(v.retailPrice),
          lowStockThreshold: v.lowStockThreshold,
          imageUrls: v.imageUrls ?? [],
        };
        if (v.form) variant.form = v.form;
        if (v.packSize) variant.packSize = v.packSize;
        if (v.wholesalePrice)
          variant.wholesalePrice = parseFloat(v.wholesalePrice);
        if (v.sku) variant.sku = v.sku;
        if (v.barcode) variant.barcode = v.barcode;
        if (v.initialStock) variant.initialStock = parseInt(v.initialStock, 10);
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
          Define dosage forms and pack sizes, then configure pricing for each variant.
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
            Forms
          </Label>
          <FormChipInput value={forms} onChange={handleFormsChange} />
        </div>
        <div>
          <Label className="font-body font-semibold text-espresso mb-2 block">
            Pack Sizes
          </Label>
          <PackSizeChipInput value={packSizes} onChange={handlePackSizesChange} />
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
          Add forms or pack sizes above to generate the variant matrix.
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
        <Button type="submit" className="gap-1.5 bg-espresso text-pearl hover:bg-espresso/90">
          Next: Review
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}