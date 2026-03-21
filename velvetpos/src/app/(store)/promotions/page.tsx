'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { toast } from 'sonner';
import Decimal from 'decimal.js';
import { Plus, Pencil } from 'lucide-react';
import { formatRupee } from '@/lib/format';
import { CreatePromotionSchema } from '@/lib/validators/promotion.validators';
import type { CreatePromotionInput, UpdatePromotionInput } from '@/lib/validators/promotion.validators';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ── Constants ────────────────────────────────────────────────────────────────

const PROMOTION_TYPE_LABELS: Record<string, string> = {
  CART_PERCENTAGE: 'Cart Percentage',
  CART_FIXED: 'Cart Fixed',
  CATEGORY_PERCENTAGE: 'Category Percentage',
  BOGO: 'Buy One Get One',
  MIX_AND_MATCH: 'Mix & Match',
  PROMO_CODE: 'Promo Code',
};

const PROMOTION_TYPES = [
  'CART_PERCENTAGE',
  'CART_FIXED',
  'CATEGORY_PERCENTAGE',
  'BOGO',
  'MIX_AND_MATCH',
  'PROMO_CODE',
] as const;

type PromotionTypeValue = (typeof PROMOTION_TYPES)[number];

// ── Types ────────────────────────────────────────────────────────────────────

interface PromotionRow {
  id: string;
  name: string;
  type: string;
  value: string | number;
  promoCode: string | null;
  targetCategoryId: string | null;
  targetCategory: { id: string; name: string } | null;
  minQuantity: number | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  description: string | null;
}

interface CategoryOption {
  id: string;
  name: string;
}

// ── Badge Style Helper ───────────────────────────────────────────────────────

function getTypeBadgeClasses(type: string): string {
  switch (type) {
    case 'CART_PERCENTAGE':
    case 'CART_FIXED':
      return 'bg-sand text-espresso';
    case 'CATEGORY_PERCENTAGE':
      return 'bg-mist text-espresso';
    case 'BOGO':
    case 'MIX_AND_MATCH':
      return 'bg-terracotta text-pearl';
    case 'PROMO_CODE':
      return 'bg-espresso text-pearl';
    default:
      return 'bg-sand text-espresso';
  }
}

function formatValue(type: string, value: string | number): string {
  const v = new Decimal(value.toString());
  if (type === 'CART_PERCENTAGE' || type === 'CATEGORY_PERCENTAGE' || type === 'PROMO_CODE') {
    return `${v.toString()}%`;
  }
  return formatRupee(v.toNumber());
}

function formatDateRange(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt && !endsAt) return 'Always';
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  if (startsAt && endsAt) return `${fmt(startsAt)} – ${fmt(endsAt)}`;
  if (startsAt) return `From ${fmt(startsAt)}`;
  return `Until ${fmt(endsAt!)}`;
}

function getValueLabel(type: PromotionTypeValue): string {
  if (type === 'CART_PERCENTAGE' || type === 'CATEGORY_PERCENTAGE' || type === 'PROMO_CODE') return 'Discount %';
  if (type === 'CART_FIXED') return 'Discount Amount';
  return 'Item Value Cap';
}

function getPreviewText(name: string, type: PromotionTypeValue, value: number): string {
  if (!name || value <= 0) return '';
  if (type === 'CART_PERCENTAGE' || type === 'CATEGORY_PERCENTAGE' || type === 'PROMO_CODE') {
    return `${name} — ${value}% off${type === 'CART_PERCENTAGE' ? ' your entire cart' : type === 'CATEGORY_PERCENTAGE' ? ' category' : ' with code'}`;
  }
  if (type === 'CART_FIXED') return `${name} — ${formatRupee(value)} off your cart`;
  return `${name} — Buy ${value}+ get one free`;
}

// ── Create / Edit Form ───────────────────────────────────────────────────────

interface PromotionFormProps {
  defaultValues?: Partial<CreatePromotionInput>;
  categories: CategoryOption[];
  onSubmit: (data: CreatePromotionInput) => void;
  isSubmitting: boolean;
  submitLabel: string;
}

function PromotionForm({ defaultValues, categories, onSubmit, isSubmitting, submitLabel }: PromotionFormProps) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<CreatePromotionInput>({
    resolver: standardSchemaResolver(CreatePromotionSchema),
    defaultValues: {
      name: '',
      type: 'CART_PERCENTAGE',
      value: 0,
      ...defaultValues,
    },
  });

  const watchedType = watch('type') as PromotionTypeValue;
  const watchedName = watch('name');
  const watchedValue = watch('value');

  const preview = getPreviewText(watchedName, watchedType, watchedValue ?? 0);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name" className="font-body text-sm text-espresso">Name</Label>
        <Input id="name" {...register('name')} placeholder="Summer Sale" className="font-body" />
        {errors.name && <p className="text-xs text-[#9B2226]">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="type" className="font-body text-sm text-espresso">Type</Label>
        <Select
          value={watchedType}
          onValueChange={(v) => setValue('type', v as PromotionTypeValue)}
        >
          <SelectTrigger className="font-body">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROMOTION_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="font-body">
                {PROMOTION_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="value" className="font-body text-sm text-espresso">{getValueLabel(watchedType)}</Label>
        <Input
          id="value"
          type="number"
          step="any"
          {...register('value', { valueAsNumber: true })}
          className="font-body"
        />
        {errors.value && <p className="text-xs text-[#9B2226]">{errors.value.message}</p>}
      </div>

      {watchedType === 'PROMO_CODE' && (
        <div className="space-y-1.5">
          <Label htmlFor="promoCode" className="font-body text-sm text-espresso">Promo Code</Label>
          <Input id="promoCode" {...register('promoCode')} placeholder="SUMMER20" className="font-mono uppercase" />
          {errors.promoCode && <p className="text-xs text-[#9B2226]">{errors.promoCode.message}</p>}
        </div>
      )}

      {watchedType === 'CATEGORY_PERCENTAGE' && (
        <div className="space-y-1.5">
          <Label htmlFor="targetCategoryId" className="font-body text-sm text-espresso">Category</Label>
          <Select
            value={watch('targetCategoryId') ?? ''}
            onValueChange={(v) => setValue('targetCategoryId', v)}
          >
            <SelectTrigger className="font-body">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id} className="font-body">
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {(watchedType === 'BOGO' || watchedType === 'MIX_AND_MATCH') && (
        <div className="space-y-1.5">
          <Label htmlFor="minQuantity" className="font-body text-sm text-espresso">Min Quantity</Label>
          <Input
            id="minQuantity"
            type="number"
            {...register('minQuantity', { valueAsNumber: true })}
            placeholder="2"
            className="font-body"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="startsAt" className="font-body text-sm text-espresso">Start Date</Label>
          <Input id="startsAt" type="date" {...register('startsAt')} className="font-body" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endsAt" className="font-body text-sm text-espresso">End Date</Label>
          <Input id="endsAt" type="date" {...register('endsAt')} className="font-body" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description" className="font-body text-sm text-espresso">Description</Label>
        <Textarea
          id="description"
          {...register('description')}
          placeholder="Optional description..."
          className="font-body"
          rows={2}
        />
      </div>

      {preview && (
        <div className="rounded-lg border border-mist/50 bg-linen p-3">
          <p className="font-body text-xs text-mist mb-1">Preview</p>
          <p className="font-body text-sm text-espresso">{preview}</p>
        </div>
      )}

      <Button type="submit" disabled={isSubmitting} className="w-full bg-espresso text-pearl hover:bg-espresso/90 font-body">
        {isSubmitting ? 'Saving...' : submitLabel}
      </Button>
    </form>
  );
}

// ── Page Component ───────────────────────────────────────────────────────────

export default function PromotionsPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editPromo, setEditPromo] = useState<PromotionRow | null>(null);

  // Fetch promotions
  const { data, isLoading } = useQuery({
    queryKey: ['promotions'],
    queryFn: async () => {
      const res = await fetch('/api/store/promotions');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      return json.data as PromotionRow[];
    },
  });

  // Fetch categories for category select
  const { data: categories = [] } = useQuery({
    queryKey: ['categories-list'],
    queryFn: async () => {
      const res = await fetch('/api/store/categories');
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data ?? []) as CategoryOption[];
    },
  });

  const promotions = data ?? [];
  const activeCount = promotions.filter((p) => p.isActive).length;

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (payload: CreatePromotionInput) => {
      const res = await fetch('/api/store/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? 'Failed to create');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      setCreateOpen(false);
      toast.success('Promotion created');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data: payload }: { id: string; data: UpdatePromotionInput }) => {
      const res = await fetch(`/api/store/promotions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? 'Failed to update');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      setEditPromo(null);
      toast.success('Promotion updated');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/store/promotions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error('Failed to toggle');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
  });

  // Deactivate mutation (DELETE = toggle off)
  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/store/promotions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to deactivate');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      setEditPromo(null);
      toast.success('Promotion deactivated');
    },
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-espresso">Promotions</h1>
          <p className="font-body text-sm text-mist">
            {activeCount} active promotion{activeCount !== 1 ? 's' : ''}
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-espresso text-pearl hover:bg-espresso/90 font-body gap-1.5">
              <Plus className="h-4 w-4" />
              New Promotion
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-lg text-espresso">Create Promotion</DialogTitle>
            </DialogHeader>
            <PromotionForm
              categories={categories}
              onSubmit={(data) => createMutation.mutate(data)}
              isSubmitting={createMutation.isPending}
              submitLabel="Create Promotion"
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : promotions.length === 0 ? (
        <div className="text-center py-16">
          <p className="font-body text-mist">No promotions yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="border border-mist/30 rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-linen/50">
                <TableHead className="font-body text-xs text-mist font-medium">Name</TableHead>
                <TableHead className="font-body text-xs text-mist font-medium">Type</TableHead>
                <TableHead className="font-body text-xs text-mist font-medium">Value</TableHead>
                <TableHead className="font-body text-xs text-mist font-medium">Promo Code</TableHead>
                <TableHead className="font-body text-xs text-mist font-medium">Status</TableHead>
                <TableHead className="font-body text-xs text-mist font-medium">Valid Window</TableHead>
                <TableHead className="font-body text-xs text-mist font-medium">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promotions.map((promo) => (
                <TableRow key={promo.id} className="hover:bg-linen/30">
                  <TableCell className="font-body text-sm text-espresso font-medium">{promo.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={`font-body text-xs ${getTypeBadgeClasses(promo.type)}`}>
                      {PROMOTION_TYPE_LABELS[promo.type] ?? promo.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-espresso">
                    {formatValue(promo.type, promo.value)}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-mist">
                    {promo.type === 'PROMO_CODE' && promo.promoCode ? promo.promoCode : '—'}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={promo.isActive}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: promo.id, isActive: checked })
                      }
                    />
                  </TableCell>
                  <TableCell className="font-body text-xs text-mist">
                    {formatDateRange(promo.startsAt, promo.endsAt)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditPromo(promo)}
                      className="text-terracotta hover:text-espresso gap-1"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit Sheet */}
      <Sheet open={!!editPromo} onOpenChange={(open) => { if (!open) setEditPromo(null); }}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display text-lg text-espresso">Edit Promotion</SheetTitle>
          </SheetHeader>
          {editPromo && (
            <div className="mt-6 space-y-6">
              <PromotionForm
                key={editPromo.id}
                defaultValues={{
                  name: editPromo.name,
                  type: editPromo.type as PromotionTypeValue,
                  value: new Decimal(editPromo.value.toString()).toNumber(),
                  promoCode: editPromo.promoCode ?? undefined,
                  targetCategoryId: editPromo.targetCategoryId ?? undefined,
                  minQuantity: editPromo.minQuantity ?? undefined,
                  startsAt: editPromo.startsAt ? editPromo.startsAt.slice(0, 10) : undefined,
                  endsAt: editPromo.endsAt ? editPromo.endsAt.slice(0, 10) : undefined,
                  description: editPromo.description ?? undefined,
                }}
                categories={categories}
                onSubmit={(data) => updateMutation.mutate({ id: editPromo.id, data })}
                isSubmitting={updateMutation.isPending}
                submitLabel="Save Changes"
              />
              <div className="border-t border-mist/30 pt-4">
                <Button
                  variant="ghost"
                  className="w-full text-[#9B2226] hover:text-[#9B2226]/80 hover:bg-[#9B2226]/5 font-body"
                  onClick={() => deactivateMutation.mutate(editPromo.id)}
                  disabled={deactivateMutation.isPending}
                >
                  {deactivateMutation.isPending ? 'Deactivating...' : 'Deactivate Promotion'}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
