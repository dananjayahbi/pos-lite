'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { usePackaging } from '@/hooks/delivery';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import type { PackagingCategory, PackagingUnit } from '@/generated/prisma/client';
import {
  CreatePackagingItemSchema,
  PackagingStockAdjustSchema,
} from '@/lib/validators/packaging.validators';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, PackagePlus } from 'lucide-react';
import { PackagingStockTable } from '@/components/delivery/packaging/PackagingStockTable';

const CATEGORY_OPTIONS: { value: PackagingCategory; label: string }[] = [
  { value: 'POLYMAILER', label: 'Polymailer' },
  { value: 'TAPE', label: 'Tape' },
  { value: 'LABEL', label: 'Label' },
  { value: 'BUBBLE_WRAP', label: 'Bubble Wrap' },
  { value: 'OTHER', label: 'Other' },
];

const UNIT_OPTIONS: { value: PackagingUnit; label: string }[] = [
  { value: 'PIECE', label: 'Piece' },
  { value: 'ROLL', label: 'Roll' },
  { value: 'BOX', label: 'Box' },
  { value: 'METER', label: 'Meter' },
];

interface PackagingItem {
  id: string;
  name: string;
  category: string;
  sku?: string | null;
  unit: string;
  quantityOnHand: number;
  lowStockThreshold: number;
  autoDeduct: boolean;
  consumptionPerParcel?: number | string | null;
}

export function PackagingPageClient() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission(PERMISSIONS.DELIVERY.managePackaging);
  const { data, isLoading, create, adjust } = usePackaging();

  const [addOpen, setAddOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<PackagingItem | null>(null);

  const addForm = useForm<z.input<typeof CreatePackagingItemSchema>, unknown, z.output<typeof CreatePackagingItemSchema>>({
    resolver: standardSchemaResolver(CreatePackagingItemSchema),
    defaultValues: {
      category: 'OTHER',
      name: '',
      sku: '',
      unit: 'PIECE',
      quantityOnHand: 0,
      lowStockThreshold: 0,
      autoDeduct: false,
      consumptionPerParcel: undefined,
    },
  });

  const adjustForm = useForm<z.input<typeof PackagingStockAdjustSchema>, unknown, z.output<typeof PackagingStockAdjustSchema>>({
    resolver: standardSchemaResolver(PackagingStockAdjustSchema),
    defaultValues: { delta: 0, note: '' },
  });

  if (!canManage) {
    return (
      <Card className="border-mist">
        <CardContent className="p-8 text-center text-sm text-espresso/60">
          You do not have permission to manage packaging stock.
        </CardContent>
      </Card>
    );
  }

  const items = (data as PackagingItem[] | undefined) ?? [];

  const onAddSubmit = (formData: z.output<typeof CreatePackagingItemSchema>) => {
    create.mutate(formData as Record<string, unknown>, {
      onSuccess: () => {
        setAddOpen(false);
        addForm.reset();
      },
    });
  };

  const openAdjust = (item: PackagingItem) => {
    setAdjustItem(item);
    adjustForm.reset({ delta: 0, note: '' });
  };

  const onAdjustSubmit = (formData: z.output<typeof PackagingStockAdjustSchema>) => {
    if (!adjustItem) return;
    adjust.mutate({ id: adjustItem.id, delta: formData.delta, ...(formData.note ? { note: formData.note } : {}) });
    setAdjustItem(null);
    adjustForm.reset();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-espresso">Packaging Stock</h1>
          <p className="text-sm text-espresso/60">
            Packaging materials consumed when parcels are dispatched.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Item
        </Button>
      </div>

      <Card className="border-mist">
        <CardHeader>
          <CardTitle className="font-display text-lg">Inventory</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <PackagingStockTable items={items} onAdjust={openAdjust} />
          )}
        </CardContent>
      </Card>

      {/* Add Item dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Add Packaging Item</DialogTitle>
            <DialogDescription>
              Create a new packaging material to track per-parcel consumption.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={addForm.watch('category') ?? ''}
                  onValueChange={(v) => addForm.setValue('category', v as PackagingCategory)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select
                  value={addForm.watch('unit') ?? ''}
                  onValueChange={(v) => addForm.setValue('unit', v as PackagingUnit)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pkg-name">Name *</Label>
              <Input id="pkg-name" {...addForm.register('name')} placeholder="e.g. Polymailer M" />
              {addForm.formState.errors.name && (
                <p className="text-sm text-terracotta">
                  {addForm.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pkg-sku">SKU</Label>
              <Input id="pkg-sku" {...addForm.register('sku')} placeholder="Optional SKU" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pkg-qty">On Hand</Label>
                <Input
                  id="pkg-qty"
                  type="number"
                  step="1"
                  min={0}
                  {...addForm.register('quantityOnHand')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pkg-threshold">Low Stock At</Label>
                <Input
                  id="pkg-threshold"
                  type="number"
                  step="1"
                  min={0}
                  {...addForm.register('lowStockThreshold')}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pkg-per-parcel">Per Parcel</Label>
                <Input
                  id="pkg-per-parcel"
                  type="number"
                  step="any"
                  min={0}
                  {...addForm.register('consumptionPerParcel')}
                  placeholder="1"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-espresso">
              <Checkbox
                checked={addForm.watch('autoDeduct') ?? false}
                onCheckedChange={(checked) => addForm.setValue('autoDeduct', checked === true)}
              />
              Auto-deduct on dispatch
            </label>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Creating...' : 'Create Item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stock adjust dialog */}
      <Dialog open={!!adjustItem} onOpenChange={(open) => !open && setAdjustItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Adjust Stock</DialogTitle>
            <DialogDescription>
              {adjustItem
                ? `Update on-hand quantity for ${adjustItem.name}.`
                : 'Update on-hand quantity for a packaging item.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={adjustForm.handleSubmit(onAdjustSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="adj-delta">Delta</Label>
              <Input
                id="adj-delta"
                type="number"
                step="1"
                {...adjustForm.register('delta')}
                placeholder="e.g. 10 (in) or -5 (out)"
              />
              {adjustForm.formState.errors.delta && (
                <p className="text-sm text-terracotta">
                  {adjustForm.formState.errors.delta.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adj-note">Note</Label>
              <Input
                id="adj-note"
                {...adjustForm.register('note')}
                placeholder="Optional reason (audited)"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAdjustItem(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={adjust.isPending}>
                {adjust.isPending ? 'Adjusting...' : 'Adjust Stock'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {items.length === 0 && !isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-espresso/20 py-8 text-sm text-espresso/50">
          <PackagePlus className="h-5 w-5" />
          No packaging items — add your first item above.
        </div>
      )}
    </div>
  );
}
