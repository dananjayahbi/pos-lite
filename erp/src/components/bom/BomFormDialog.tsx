'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useBom, useBomEligibleVariants, useCreateBom, useUpdateBom, type BomIngredientView } from '@/hooks/useBom';
import { useRawMaterials, type RawMaterialItem } from '@/hooks/useRawMaterials';
import { getUnitLabel, getUnitShortLabel } from '@/lib/services/rawMaterial.core';
import {
  findDuplicateRawMaterialIds,
  INGREDIENT_DUPLICATE_MESSAGE,
} from '@/lib/services/bom.core';
import {
  factoryFeedErrorMessage,
} from '@/components/raw-materials/factoryDashboardState';

interface BomFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingBomId: string | null;
}

interface IngredientRow {
  rawMaterialId: string;
  quantityPerUnit: string;
}

const EMPTY_ROW: IngredientRow = { rawMaterialId: '', quantityPerUnit: '' };

interface FormState {
  variantId: string;
  name: string;
  notes: string;
  ingredients: IngredientRow[];
}

const EMPTY_FORM: FormState = {
  variantId: '',
  name: '',
  notes: '',
  ingredients: [{ ...EMPTY_ROW }],
};

export function BomFormDialog({ open, onOpenChange, editingBomId }: BomFormDialogProps) {
  const isEdit = editingBomId !== null;
  const {
    data: detailData,
    isError: detailError,
    error: detailErrorObj,
    isFetching: detailFetching,
    refetch: refetchDetail,
  } = useBom(editingBomId);
  // ARGUS #250: only manufactured variants without an existing BOM are offered.
  const { data: eligibleData } = useBomEligibleVariants(open && !isEdit);
  // ARGUS #254: the ingredient picker was capped at the first 100 materials.
  // It now searches server-side and keeps any already-selected row visible.
  const [materialSearch, setMaterialSearch] = useState('');
  const [debouncedMaterialSearch, setDebouncedMaterialSearch] = useState('');
  const { data: materialsData } = useRawMaterials({
    limit: 50,
    ...(debouncedMaterialSearch ? { search: debouncedMaterialSearch } : {}),
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedMaterialSearch(materialSearch.trim()), 300);
    return () => clearTimeout(timer);
  }, [materialSearch]);

  const [materialCache, setMaterialCache] = useState<Map<string, RawMaterialItem>>(new Map());
  useEffect(() => {
    if (!materialsData?.data) return;
    setMaterialCache((previous) => {
      const next = new Map(previous);
      for (const material of materialsData.data) next.set(material.id, material);
      return next;
    });
  }, [materialsData]);

  const createMutation = useCreateBom();
  const updateMutation = useUpdateBom();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (isEdit && detailData?.data) {
      const detail = detailData.data;
      setForm({
        variantId: detail.variantId,
        name: detail.name,
        notes: detail.notes ?? '',
        ingredients:
          detail.ingredients.length > 0
            ? detail.ingredients.map((ing: BomIngredientView) => ({
                rawMaterialId: ing.rawMaterialId,
                quantityPerUnit: String(ing.quantityPerUnit),
              }))
            : [{ ...EMPTY_ROW }],
      });
    } else if (!isEdit) {
      setForm(EMPTY_FORM);
    }
    setError(null);
    setMaterialSearch('');
    setDebouncedMaterialSearch('');
  }, [open, isEdit, detailData]);

  const fetchedMaterials = materialsData?.data ?? [];
  const selectedMaterialIds = new Set(
    form.ingredients.map((row) => row.rawMaterialId).filter(Boolean),
  );
  // The current search result first, then any selected material that the search
  // no longer returned so a saved recipe keeps showing its ingredient names.
  const materials = [
    ...fetchedMaterials,
    ...[...materialCache.values()].filter(
      (cached) =>
        selectedMaterialIds.has(cached.id) &&
        !fetchedMaterials.some((material) => material.id === cached.id),
    ),
  ];

  const variants = (eligibleData?.data ?? []).map((variant) => ({
    id: variant.id,
    label: `${variant.productName} - ${variant.sku}`,
  }));
  const noEligibleVariants = !isEdit && eligibleData !== undefined && variants.length === 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const filled = form.ingredients.filter((r) => r.rawMaterialId && r.quantityPerUnit);
    if (filled.length === 0) {
      setError('Add at least one ingredient.');
      return;
    }
    // ARGUS #249: never send the same raw material twice; the DB unique
    // constraint would reject it as a generic failure after Save.
    if (findDuplicateRawMaterialIds(filled).length > 0) {
      setError(INGREDIENT_DUPLICATE_MESSAGE);
      return;
    }

    const run = isEdit
      ? updateMutation.mutateAsync({
          id: editingBomId as string,
          name: form.name,
          ...(form.notes ? { notes: form.notes } : {}),
          ingredients: filled,
        })
      : createMutation.mutateAsync({
          variantId: form.variantId,
          name: form.name,
          ...(form.notes ? { notes: form.notes } : {}),
          ingredients: filled,
        });
    run
      .then(() => {
        toast.success(isEdit ? 'BOM updated' : 'BOM created');
        onOpenChange(false);
      })
      .catch((err: Error) => setError(err.message));
  };

  const updateIngredient = (index: number, patch: Partial<IngredientRow>) => {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  };

  const removeIngredient = (index: number) => {
    setForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Bill of Materials' : 'New Bill of Materials'}</DialogTitle>
          <DialogDescription>
            Specify the finished product and the raw materials consumed per unit.
          </DialogDescription>
        </DialogHeader>
        {isEdit && detailError ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-center"
          >
            <AlertTriangle className="h-6 w-6 text-red-500" />
            <p className="font-body text-sm font-medium text-red-800">
              BOM details could not be loaded
            </p>
            <p className="font-body text-xs text-red-600">
              {factoryFeedErrorMessage(detailErrorObj, 'The recipe request failed.')}
            </p>
            <p className="font-body text-xs text-red-600">
              The form stays empty until the recipe loads, so Save cannot overwrite it.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-red-200 bg-white text-red-700 hover:bg-red-100"
              onClick={() => refetchDetail()}
              disabled={detailFetching}
            >
              <RefreshCw className={`mr-2 h-3.5 w-3.5 ${detailFetching ? 'animate-spin' : ''}`} />
              {detailFetching ? 'Retrying…' : 'Retry'}
            </Button>
          </div>
        ) : isEdit && !detailData?.data ? (
          <p className="py-8 text-center text-sm text-mist-ink">Loading BOM details…</p>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bom-variant">Finished product variant</Label>
            {isEdit ? (
              <Input
                id="bom-variant"
                disabled
                value={
                  detailData?.data
                    ? `${detailData.data.variantName} - ${detailData.data.variantSku}`
                    : ''
                }
              />
            ) : (
              <Select
                value={form.variantId}
                onValueChange={(value) => setForm({ ...form, variantId: value })}
              >
                <SelectTrigger id="bom-variant">
                  <SelectValue placeholder="Select a product variant" />
                </SelectTrigger>
                <SelectContent>
                  {variants.map((variant) => (
                    <SelectItem key={variant.id} value={variant.id}>
                      {variant.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {noEligibleVariants ? (
              <p className="text-xs text-mist-ink">
                No variants are available for a new BOM. Manufactured products
                either already have a recipe, or the product is traded.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bom-name">BOM name</Label>
            <Input
              id="bom-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Turmeric Capsules 500mg"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Ingredients (per unit produced)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    ingredients: [...prev.ingredients, { ...EMPTY_ROW }],
                  }))
                }
              >
                <Plus className="mr-1 h-4 w-4" /> Add ingredient
              </Button>
            </div>
            <div className="space-y-2">
              <Input
                placeholder="Search raw materials by name…"
                aria-label="Search raw materials"
                value={materialSearch}
                onChange={(event) => setMaterialSearch(event.target.value)}
              />
              <p className="text-xs text-mist-ink">
                Showing {materials.length} material{materials.length === 1 ? '' : 's'}
                {debouncedMaterialSearch
                  ? ` matching "${debouncedMaterialSearch}"`
                  : ' - type to search the full catalogue'}
                .
              </p>
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-[minmax(0,1fr)_90px_70px_120px_32px] gap-2 px-1 text-xs font-medium uppercase tracking-wide text-mist-ink">
                <span>Raw material</span>
                <span className="text-right">Available</span>
                <span>Unit</span>
                <span>Qty / unit</span>
                <span />
              </div>
              {form.ingredients.map((row, index) => {
                const selected = materials.find((m) => m.id === row.rawMaterialId);
                // ARGUS #249: a material already used on another row cannot be
                // picked again, so duplicates are impossible from the form.
                const usedElsewhere = new Set(
                  form.ingredients
                    .filter((_, i) => i !== index)
                    .map((r) => r.rawMaterialId)
                    .filter(Boolean),
                );
                return (
                  <div
                    key={index}
                    className="grid grid-cols-[minmax(0,1fr)_90px_70px_120px_32px] items-center gap-2"
                  >
                    <Select
                      value={row.rawMaterialId}
                      onValueChange={(value) =>
                        updateIngredient(index, { rawMaterialId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select raw material" />
                      </SelectTrigger>
                      <SelectContent>
                        {materials.map((material) => (
                          <SelectItem
                            key={material.id}
                            value={material.id}
                            disabled={usedElsewhere.has(material.id)}
                          >
                            {material.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-right text-sm text-espresso">
                      {selected ? selected.quantity : '-'}
                    </div>
                    <div className="text-sm text-mist-ink">
                      {selected ? (selected.unitName ?? getUnitLabel(selected.unit)) : '-'}
                    </div>
                    <div className="relative">
                      <Input
                        inputMode="decimal"
                        className="pr-10"
                        placeholder="0"
                        value={row.quantityPerUnit}
                        onChange={(e) =>
                          updateIngredient(index, { quantityPerUnit: e.target.value })
                        }
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-xs text-mist-ink">
                        {selected
                          ? (selected.unitShortLabel ?? getUnitShortLabel(selected.unit))
                          : ''}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-600"
                      disabled={form.ingredients.length === 1}
                      onClick={() => removeIngredient(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bom-notes">Notes (optional)</Label>
            <Textarea
              id="bom-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Any notes about this recipe"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                createMutation.isPending ||
                updateMutation.isPending ||
                noEligibleVariants ||
                (!isEdit && !form.variantId)
              }
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save BOM'}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
