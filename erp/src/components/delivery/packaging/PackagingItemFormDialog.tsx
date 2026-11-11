'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { Settings2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PackagingCategoryEditor } from '@/components/delivery/packaging/PackagingCategoryEditor';
import { usePackagingCategories, type PackagingItemRow } from '@/hooks/delivery/usePackaging';
import {
  CreatePackagingItemSchema,
  PACKAGING_UNITS,
  type PackagingUnit,
} from '@/lib/validators/packaging.validators';
import { getPackagingUnitLabel, getPackagingUnitShortLabel } from '@/lib/constants/packaging';

type FormInput = z.input<typeof CreatePackagingItemSchema>;

interface PackagingItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing; absent when creating. */
  item?: PackagingItemRow | null;
  createPending: boolean;
  updatePending: boolean;
  onCreate: (values: Record<string, unknown>) => void;
  onUpdate: (id: string, values: Record<string, unknown>) => void;
}

const UNITS: PackagingUnit[] = [...PACKAGING_UNITS];

function emptyDefaults(): FormInput {
  return {
    category: 'OTHER',
    name: '',
    sku: '',
    autoGenerateSku: true,
    unit: 'PIECE',
    quantityOnHand: 0,
    lowStockThreshold: 0,
    autoDeduct: false,
    consumptionPerParcel: undefined,
  };
}

function itemDefaults(item: PackagingItemRow): FormInput {
  return {
    category: item.category,
    name: item.name,
    sku: item.sku ?? '',
    autoGenerateSku: false,
    unit: item.unit as PackagingUnit,
    quantityOnHand: item.quantityOnHand,
    lowStockThreshold: item.lowStockThreshold,
    autoDeduct: item.autoDeduct,
    consumptionPerParcel:
      item.consumptionPerParcel != null && item.consumptionPerParcel !== ''
        ? Number(item.consumptionPerParcel)
        : undefined,
  };
}

export function PackagingItemFormDialog({
  open,
  onOpenChange,
  item,
  createPending,
  updatePending,
  onCreate,
  onUpdate,
}: PackagingItemFormDialogProps) {
  const isEdit = Boolean(item);
  const { data: categories } = usePackagingCategories();
  const [showCategoryEditor, setShowCategoryEditor] = useState(false);

  const form = useForm<FormInput, unknown, z.output<typeof CreatePackagingItemSchema>>({
    resolver: standardSchemaResolver(CreatePackagingItemSchema),
    defaultValues: emptyDefaults(),
  });

  useEffect(() => {
    if (!open) return;
    form.reset(item ? itemDefaults(item) : emptyDefaults());
    setShowCategoryEditor(false);
  }, [open, item, form]);

  useEffect(() => {
    // Keep the selected category valid if the list finishes loading after the
    // dialog opened (or a category was just created).
    if (!categories || categories.length === 0) return;
    const current = form.getValues('category');
    if (!categories.some((c) => c.key === current)) {
      form.setValue('category', categories[0]!.key);
    }
  }, [categories, form]);

  const unit = (form.watch('unit') ?? 'PIECE') as PackagingUnit;
  const suffix = getPackagingUnitShortLabel(unit);
  const autoSku = form.watch('autoGenerateSku') ?? false;

  const onSubmit = (values: z.output<typeof CreatePackagingItemSchema>) => {
    const { autoGenerateSku, ...rest } = values;
    const payload: Record<string, unknown> = { ...rest };
    if (isEdit) {
      if (payload.consumptionPerParcel === undefined) payload.consumptionPerParcel = null;
      onUpdate(item!.id, payload);
      return;
    }
    if (payload.sku === '') delete payload.sku;
    payload.autoGenerateSku = autoGenerateSku;
    onCreate(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {isEdit ? 'Edit Packaging Item' : 'Add Packaging Item'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this packaging material and its per-parcel consumption.'
              : 'Create a new packaging material to track per-parcel consumption.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>Category</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-espresso/60 h-6 px-1.5 text-xs"
                  onClick={() => setShowCategoryEditor((v) => !v)}
                >
                  <Settings2 className="mr-1 h-3.5 w-3.5" />
                  {showCategoryEditor ? 'Done' : 'Manage'}
                </Button>
              </div>
              <Select
                value={form.watch('category') ?? ''}
                onValueChange={(v) => form.setValue('category', v, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {(categories ?? []).map((opt) => (
                    <SelectItem key={opt.id} value={opt.key}>
                      {opt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select
                value={form.watch('unit') ?? ''}
                onValueChange={(v) => form.setValue('unit', v as PackagingUnit)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {getPackagingUnitLabel(opt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {showCategoryEditor ? (
            <div className="border-espresso/10 bg-espresso/[0.02] rounded-lg border p-3">
              <PackagingCategoryEditor />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="pkg-name">Name *</Label>
            <Input id="pkg-name" {...form.register('name')} placeholder="e.g. Polymailer M" />
            {form.formState.errors.name && (
              <p className="text-terracotta text-sm">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pkg-sku">SKU</Label>
            <Input
              id="pkg-sku"
              {...form.register('sku')}
              disabled={!isEdit && autoSku}
              placeholder={
                !isEdit && autoSku ? 'Auto-generated from category + name' : 'Optional SKU'
              }
            />
            {!isEdit ? (
              <label className="text-espresso flex items-center gap-2 text-sm">
                <Checkbox
                  checked={autoSku}
                  onCheckedChange={(checked) => form.setValue('autoGenerateSku', checked === true)}
                />
                Auto-generate SKU
              </label>
            ) : null}
          </div>

          {/* `items-end` keeps the three inputs on one baseline when a long
              unit suffix wraps one of the labels onto a second line. */}
          <div className="grid grid-cols-3 items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="pkg-qty">On Hand{suffix ? ` (${suffix})` : ''}</Label>
              <Input
                id="pkg-qty"
                type="number"
                step="1"
                min={0}
                {...form.register('quantityOnHand')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pkg-threshold">Low Stock At{suffix ? ` (${suffix})` : ''}</Label>
              <Input
                id="pkg-threshold"
                type="number"
                step="1"
                min={0}
                {...form.register('lowStockThreshold')}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pkg-per-parcel">Per Parcel{suffix ? ` (${suffix})` : ''}</Label>
              <Input
                id="pkg-per-parcel"
                type="number"
                step="any"
                min={0}
                {...form.register('consumptionPerParcel', {
                  setValueAs: (v) => (v === '' || v === null ? undefined : Number(v)),
                })}
                placeholder="1"
              />
            </div>
          </div>

          <label className="text-espresso flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.watch('autoDeduct') ?? false}
              onCheckedChange={(checked) => form.setValue('autoDeduct', checked === true)}
            />
            Auto-deduct on dispatch
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createPending || updatePending}>
              {createPending || updatePending
                ? 'Saving...'
                : isEdit
                  ? 'Save Changes'
                  : 'Create Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
