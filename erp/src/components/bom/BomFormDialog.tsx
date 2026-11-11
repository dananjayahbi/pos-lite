'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
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
import { useBom, useCreateBom, useUpdateBom, type BomIngredientView } from '@/hooks/useBom';
import { useRawMaterials } from '@/hooks/useRawMaterials';
import { useProducts } from '@/hooks/useProducts';
import { getUnitLabel, getUnitShortLabel } from '@/lib/services/rawMaterial.core';

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
  const { data: detailData } = useBom(editingBomId);
  const { data: productsData } = useProducts({ limit: 100 });
  const { data: materialsData } = useRawMaterials({ limit: 100 });

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
  }, [open, isEdit, detailData]);

  const products = productsData?.data ?? [];
  const materials = materialsData?.data ?? [];

  const variants = products.flatMap((product) =>
    (product.variants ?? []).map((variant) => ({
      id: variant.id,
      label: `${product.name} — ${variant.sku}`,
    })),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const filled = form.ingredients.filter((r) => r.rawMaterialId && r.quantityPerUnit);
    if (filled.length === 0) {
      setError('Add at least one ingredient.');
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
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bom-variant">Finished product variant</Label>
            <Select
              value={form.variantId}
              onValueChange={(value) => setForm({ ...form, variantId: value })}
            >
              <SelectTrigger id="bom-variant" disabled={isEdit}>
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
              <div className="grid grid-cols-[minmax(0,1fr)_90px_70px_120px_32px] gap-2 px-1 text-xs font-medium uppercase tracking-wide text-mist-ink">
                <span>Raw material</span>
                <span className="text-right">Available</span>
                <span>Unit</span>
                <span>Qty / unit</span>
                <span />
              </div>
              {form.ingredients.map((row, index) => {
                const selected = materials.find((m) => m.id === row.rawMaterialId);
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
                          <SelectItem key={material.id} value={material.id}>
                            {material.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-right text-sm text-espresso">
                      {selected ? selected.quantity : '—'}
                    </div>
                    <div className="text-sm text-mist-ink">
                      {selected ? (selected.unitName ?? getUnitLabel(selected.unit)) : '—'}
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
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save BOM'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
