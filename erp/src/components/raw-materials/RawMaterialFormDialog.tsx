'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Settings2 } from 'lucide-react';
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
import type { RawMaterialItem } from '@/hooks/useRawMaterials';
import { RawMaterialCategoryManagerDialog } from '@/components/raw-materials/RawMaterialCategoryManagerDialog';
import {
  useCreateRawMaterialCategory,
  useRawMaterialCategories,
} from '@/hooks/useRawMaterialCategories';
import {
  useCreateRawMaterialUnit,
  useRawMaterialUnits,
} from '@/hooks/useRawMaterialUnits';

interface RawMaterialFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: RawMaterialItem | null; // null = create
}

interface FormState {
  name: string;
  category: string;
  unit: string;
  quantity: string;
  lowStockThreshold: string;
  description: string;
}

const DEFAULT_CATEGORY = 'OILS_LIQUIDS';

const EMPTY: FormState = {
  name: '',
  category: DEFAULT_CATEGORY,
  unit: 'LITERS',
  quantity: '0',
  lowStockThreshold: '0',
  description: '',
};

function toFormState(material: RawMaterialItem | null): FormState {
  if (!material) return { ...EMPTY };
  return {
    name: material.name,
    category: material.category,
    unit: material.unit,
    quantity: String(material.quantity),
    lowStockThreshold: String(material.lowStockThreshold),
    description: material.description ?? '',
  };
}

export function RawMaterialFormDialog({
  open,
  onOpenChange,
  material,
}: RawMaterialFormDialogProps) {
  const queryClient = useQueryClient();
  const { data: categoriesData } = useRawMaterialCategories();
  const createCategoryMutation = useCreateRawMaterialCategory();
  const categories = (categoriesData?.data ?? []).filter((category) => category.isActive);

  const { data: unitsData } = useRawMaterialUnits();
  const createUnitMutation = useCreateRawMaterialUnit();
  const units = (unitsData?.data ?? []).filter((unit) => unit.isActive);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingUnit, setAddingUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitShortLabel, setNewUnitShortLabel] = useState('');
  const isEdit = material !== null;

  // Keep the select valid when the tenant removed the material's category, and
  // fall back to the first active category when creating a new material.
  const currentCategoryMissing =
    Boolean(form.category) && !categories.some((category) => category.key === form.category);
  const categoryOptions =
    isEdit && currentCategoryMissing
      ? [
          { id: 'current', key: form.category, name: material?.categoryName ?? form.category },
          ...categories,
        ]
      : categories;
  const selectedCategory =
    isEdit && currentCategoryMissing
      ? form.category
      : categories.some((category) => category.key === form.category)
        ? form.category
        : (categories[0]?.key ?? form.category);

  // Same fallback contract as categories: keep an edit form valid even if the
  // tenant removed the material's unit, and default new materials to the first
  // active unit from the tenant's catalog.
  const currentUnitMissing =
    Boolean(form.unit) && !units.some((unit) => unit.key === form.unit);
  const unitOptions =
    isEdit && currentUnitMissing
      ? [
          {
            id: 'current',
            key: form.unit,
            name: material?.unitName ?? form.unit,
            shortLabel: material?.unitShortLabel ?? form.unit,
          },
          ...units,
        ]
      : units;
  const selectedUnit =
    isEdit && currentUnitMissing
      ? form.unit
      : units.some((unit) => unit.key === form.unit)
        ? form.unit
        : (units[0]?.key ?? form.unit);

  useEffect(() => {
    if (open) {
      setForm(toFormState(material));
      setError(null);
      setAddingCategory(false);
      setNewCategoryName('');
      setAddingUnit(false);
      setNewUnitName('');
      setNewUnitShortLabel('');
    }
  }, [open, material]);

  const handleCreateCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setError(null);
    createCategoryMutation
      .mutateAsync(name)
      .then((json: { data?: { key?: string } } | null) => {
        const key = json?.data?.key;
        if (key) {
          setForm((prev) => ({ ...prev, category: key }));
        }
        setNewCategoryName('');
        setAddingCategory(false);
        toast.success('Category added');
      })
      .catch((err: Error) => setError(err.message));
  };

  const handleCreateUnit = () => {
    const name = newUnitName.trim();
    if (!name) return;
    setError(null);
    createUnitMutation
      .mutateAsync({
        name,
        ...(newUnitShortLabel.trim() ? { shortLabel: newUnitShortLabel.trim() } : {}),
      })
      .then((json: { data?: { key?: string } } | null) => {
        const key = json?.data?.key;
        if (key) {
          setForm((prev) => ({ ...prev, unit: key }));
        }
        setNewUnitName('');
        setNewUnitShortLabel('');
        setAddingUnit(false);
        toast.success('Unit added');
      })
      .catch((err: Error) => setError(err.message));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        category: selectedCategory,
        unit: selectedUnit,
        quantity: form.quantity || '0',
        lowStockThreshold: form.lowStockThreshold || '0',
        description: form.description || undefined,
      };
      const res = await fetch(
        isEdit ? `/api/store/raw-materials/${material?.id}` : '/api/store/raw-materials',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? 'Request failed');
      return json;
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Raw material updated' : 'Raw material created');
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      queryClient.invalidateQueries({ queryKey: ['raw-material-stats'] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit raw material' : 'Add raw material'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the details for this raw material.'
              : 'Create a new bulk ingredient or packaging item to track on the factory floor.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rm-name">Name</Label>
            <Input
              id="rm-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Coconut Oil"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="rm-category">Category</Label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1 text-xs"
                    onClick={() => setAddingCategory((prev) => !prev)}
                  >
                    <Plus className="mr-1 h-3 w-3" /> New
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    title="Manage categories"
                    onClick={() => setManagerOpen(true)}
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <Select
                value={selectedCategory}
                onValueChange={(value) => setForm({ ...form, category: value })}
              >
                <SelectTrigger id="rm-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((category) => (
                    <SelectItem key={category.id} value={category.key}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {addingCategory ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="New category name"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateCategory();
                      }
                    }}
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateCategory}
                    disabled={createCategoryMutation.isPending || !newCategoryName.trim()}
                  >
                    Add
                  </Button>
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="rm-unit">Unit</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1 text-xs"
                  onClick={() => setAddingUnit((prev) => !prev)}
                >
                  <Plus className="mr-1 h-3 w-3" /> New
                </Button>
              </div>
              <Select
                value={selectedUnit}
                onValueChange={(value) => setForm({ ...form, unit: value })}
              >
                <SelectTrigger id="rm-unit">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {unitOptions.map((unit) => (
                    <SelectItem key={unit.id} value={unit.key}>
                      {unit.name}
                      {unit.shortLabel && unit.shortLabel !== unit.name
                        ? ` (${unit.shortLabel})`
                        : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {addingUnit ? (
                <div className="space-y-2">
                  <Input
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                    placeholder="New unit name"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateUnit();
                      }
                    }}
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      value={newUnitShortLabel}
                      onChange={(e) => setNewUnitShortLabel(e.target.value)}
                      placeholder="Short label (kg)"
                      maxLength={20}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateUnit();
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCreateUnit}
                      disabled={createUnitMutation.isPending || !newUnitName.trim()}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rm-quantity">Quantity</Label>
              <Input
                id="rm-quantity"
                inputMode="decimal"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rm-threshold">Low stock threshold</Label>
              <Input
                id="rm-threshold"
                inputMode="decimal"
                value={form.lowStockThreshold}
                onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })}
                placeholder="0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rm-description">Description (optional)</Label>
            <Textarea
              id="rm-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="Notes about this material"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <RawMaterialCategoryManagerDialog open={managerOpen} onOpenChange={setManagerOpen} />
    </Dialog>
  );
}
