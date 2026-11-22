'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { toast } from 'sonner';
import Decimal from 'decimal.js';
import { Plus, Pencil, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatRupee } from '@/lib/format';
import { auditPromotions } from '@/lib/services/promotionHygiene.core';
import {
  getPromotionLiveState,
  PROMOTION_LIVE_STATE_LABELS,
  summarizePromotionLiveStates,
  type PromotionLiveState,
} from '@/lib/services/promotionLiveState.core';
import { CreatePromotionSchema } from '@/lib/validators/promotion.validators';
import type { CreatePromotionInput, UpdatePromotionInput } from '@/lib/validators/promotion.validators';
import type { CreatePromotionFormValues } from '@/lib/validators/promotion.validators';
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
  DialogDescription,
  DialogFooter,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
// M15-01 (BUG-46) — customer pricing rules are managed in their own tab
// rather than appended to this table.
import { CustomerPricingTab } from '@/components/promotions/CustomerPricingTab';
import { PromotionProductSelect } from '@/components/promotions/PromotionProductSelect';

// ── Constants ────────────────────────────────────────────────────────────────

const PROMOTION_TYPE_LABELS: Record<string, string> = {
  CART_PERCENTAGE: 'Cart Percentage',
  CART_FIXED: 'Cart Fixed',
  CATEGORY_PERCENTAGE: 'Category Percentage',
  PRODUCT_PERCENTAGE: 'Product Percentage',
  PRODUCT_FIXED: 'Product Fixed',
  BOGO: 'Buy One Get One',
  MIX_AND_MATCH: 'Mix & Match',
  PROMO_CODE: 'Promo Code',
};

const PROMOTION_TYPES = [
  'CART_PERCENTAGE',
  'CART_FIXED',
  'CATEGORY_PERCENTAGE',
  'PRODUCT_PERCENTAGE',
  'PRODUCT_FIXED',
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
  targetProductId: string | null;
  targetProduct: { id: string; name: string } | null;
  minQuantity: number | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  description: string | null;
  /** ARGUS #331: derived from Sale.appliedPromotions (read-only). */
  usageCount?: number;
}

interface CategoryOption {
  id: string;
  name: string;
}

const PAGE_SIZE = 10;

// ── Badge Style Helper ───────────────────────────────────────────────────────

function getTypeBadgeClasses(type: string): string {
  switch (type) {
    case 'CART_PERCENTAGE':
    case 'CART_FIXED':
      return 'bg-sand text-espresso';
    case 'CATEGORY_PERCENTAGE':
    case 'PRODUCT_PERCENTAGE':
    case 'PRODUCT_FIXED':
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

/**
 * ARGUS #329 — the badge says what the row really does now: an on switch alone
 * is not enough (a future or expired window still applies to nothing).
 */
function getLiveStateBadgeClasses(state: PromotionLiveState): string {
  switch (state) {
    case 'ACTIVE_NOW':
      return 'bg-green-50 text-green-700';
    case 'ENABLED':
      return 'bg-sand text-espresso';
    case 'SCHEDULED':
      return 'bg-amber-50 text-amber-800';
    case 'EXPIRED':
      return 'bg-red-50 text-[#9B2226]';
    case 'INACTIVE':
    default:
      return 'bg-mist/20 text-mist-ink';
  }
}

function formatValue(type: string, value: string | number): string {
  const v = new Decimal(value.toString());
  if (type === 'CART_PERCENTAGE' || type === 'CATEGORY_PERCENTAGE' || type === 'PRODUCT_PERCENTAGE' || type === 'PROMO_CODE') {
    return `${v.toString()}%`;
  }
  return formatRupee(v.toNumber());
}

function formatDateRange(startsAt: string | null, endsAt: string | null): string {
  if (!startsAt && !endsAt) return 'Always';
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  if (startsAt && endsAt) return `${fmt(startsAt)} - ${fmt(endsAt)}`;
  if (startsAt) return `From ${fmt(startsAt)}`;
  return `Until ${fmt(endsAt!)}`;
}

function getValueLabel(type: PromotionTypeValue): string {
  if (type === 'CART_PERCENTAGE' || type === 'CATEGORY_PERCENTAGE' || type === 'PRODUCT_PERCENTAGE' || type === 'PROMO_CODE') return 'Discount %';
  if (type === 'CART_FIXED' || type === 'PRODUCT_FIXED') return 'Discount Amount';
  return 'Item Value Cap (Rs per free item)';
}

function getPreviewText(
  name: string,
  type: PromotionTypeValue,
  value: number,
  minQuantity?: number | undefined,
): string {
  if (!name || value <= 0) return '';
  if (type === 'CART_PERCENTAGE' || type === 'CATEGORY_PERCENTAGE' || type === 'PRODUCT_PERCENTAGE' || type === 'PROMO_CODE') {
    return `${name} - ${value}% off${
      type === 'CART_PERCENTAGE'
        ? ' your entire cart'
        : type === 'CATEGORY_PERCENTAGE'
          ? ' category'
          : type === 'PRODUCT_PERCENTAGE'
            ? ' selected product'
            : ' with code'
    }`;
  }
  if (type === 'CART_FIXED') return `${name} - ${formatRupee(value)} off your cart`;
  if (type === 'PRODUCT_FIXED') return `${name} - ${formatRupee(value)} off the selected product`;
  // ARGUS #324: describe the real rule (buy N per targeted line, free units
  // capped per item), not "Buy 2500+".
  const buy = minQuantity && minQuantity > 0 ? minQuantity : 2;
  return `${name} - Buy ${buy}, get floor(qty/${buy}) free on the selected target, up to ${formatRupee(value)} per item`;
}

// ── Create / Edit Form ───────────────────────────────────────────────────────

interface PromotionFormProps {
  defaultValues?: Partial<CreatePromotionInput>;
  categories: CategoryOption[];
  /** Label for the edited promotion's current product, if any. */
  selectedProductLabel?: string | undefined;
  onSubmit: (data: CreatePromotionInput) => void;
  isSubmitting: boolean;
  submitLabel: string;
}

function PromotionForm({
  defaultValues,
  categories,
  selectedProductLabel,
  onSubmit,
  isSubmitting,
  submitLabel,
}: PromotionFormProps) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<CreatePromotionFormValues, unknown, CreatePromotionInput>({
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
  const watchedMinQuantity = watch('minQuantity');

  const preview = getPreviewText(watchedName, watchedType, watchedValue ?? 0, watchedMinQuantity);

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
          onValueChange={(v) => {
            const next = v as PromotionTypeValue;
            setValue('type', next);
            const keepsProductTarget =
              next === 'PRODUCT_PERCENTAGE' ||
              next === 'PRODUCT_FIXED' ||
              next === 'BOGO' ||
              next === 'MIX_AND_MATCH';
            const keepsCategoryTarget =
              next === 'CATEGORY_PERCENTAGE' ||
              next === 'BOGO' ||
              next === 'MIX_AND_MATCH';
            if (!keepsProductTarget) setValue('targetProductId', undefined);
            if (!keepsCategoryTarget) setValue('targetCategoryId', undefined);
          }}
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
          {errors.targetCategoryId && (
            <p className="text-xs text-[#9B2226]">{errors.targetCategoryId.message}</p>
          )}
        </div>
      )}

      {(watchedType === 'PRODUCT_PERCENTAGE' || watchedType === 'PRODUCT_FIXED') && (
        <div className="space-y-1.5">
          <Label htmlFor="targetProductId" className="font-body text-sm text-espresso">Product</Label>
          <PromotionProductSelect
            id="targetProductId"
            value={watch('targetProductId')}
            onChange={(productId) => setValue('targetProductId', productId)}
            selectedLabel={selectedProductLabel}
            placeholder="Select product"
            disabled={isSubmitting}
          />
          {errors.targetProductId && (
            <p className="text-xs text-[#9B2226]">{errors.targetProductId.message}</p>
          )}
        </div>
      )}

      {(watchedType === 'BOGO' || watchedType === 'MIX_AND_MATCH') && (
        <div className="space-y-3 rounded-lg border border-mist/60 p-3">
          <p className="font-body text-xs text-mist-ink">
            Target - choose one product or category. Free units apply per matching
            cart line.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="bogoTargetCategoryId" className="font-body text-sm text-espresso">Category</Label>
            <Select
              value={watch('targetCategoryId') ?? ''}
              onValueChange={(v) => {
                setValue('targetCategoryId', v);
                setValue('targetProductId', undefined);
              }}
            >
              <SelectTrigger className="font-body">
                <SelectValue placeholder="Whole category" />
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
          <div className="space-y-1.5">
            <Label htmlFor="bogoTargetProductId" className="font-body text-sm text-espresso">Product</Label>
            <PromotionProductSelect
              id="bogoTargetProductId"
              value={watch('targetProductId')}
              onChange={(productId) => {
                setValue('targetProductId', productId);
                setValue('targetCategoryId', undefined);
              }}
              selectedLabel={selectedProductLabel}
              placeholder="Single product"
              disabled={isSubmitting}
            />
          </div>
          {errors.targetProductId && (
            <p className="text-xs text-[#9B2226]">{errors.targetProductId.message}</p>
          )}
        </div>
      )}

      {(watchedType === 'BOGO' || watchedType === 'MIX_AND_MATCH') && (
        <div className="space-y-1.5">
          <Label htmlFor="minQuantity" className="font-body text-sm text-espresso">Buy Quantity (N)</Label>
          <Input
            id="minQuantity"
            type="number"
            min={1}
            {...register('minQuantity', { valueAsNumber: true })}
            placeholder="2"
            className="font-body"
          />
          <p className="font-body text-[11px] text-mist-ink">
            Free units = floor(line quantity / N). The item value cap limits each
            free unit&apos;s value.
          </p>
          {errors.minQuantity && <p className="text-xs text-[#9B2226]">{errors.minQuantity.message}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="startsAt" className="font-body text-sm text-espresso">Start Date</Label>
          <Input id="startsAt" type="date" {...register('startsAt')} className="font-body" />
          {errors.startsAt && <p className="text-xs text-[#9B2226]">{errors.startsAt.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endsAt" className="font-body text-sm text-espresso">End Date</Label>
          <Input id="endsAt" type="date" {...register('endsAt')} className="font-body" />
          {errors.endsAt && <p className="text-xs text-[#9B2226]">{errors.endsAt.message}</p>}
        </div>
      </div>
      <p className="font-body text-[11px] text-mist-ink">
        Dates are inclusive local days: a start applies from 00:00 and an end
        through 23:59. A same-day window is valid as long as the start and end
        are the same date.
      </p>

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
          <p className="font-body text-xs text-mist-ink mb-1">Preview</p>
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

interface PromotionsPageClientProps {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageCustomerPricing: boolean;
}

export default function PromotionsPage({
  canCreate,
  canEdit,
  canDelete,
  canManageCustomerPricing,
}: PromotionsPageClientProps) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editPromo, setEditPromo] = useState<PromotionRow | null>(null);
  // ARGUS #325: Deactivate and Activate are separate, explicit actions.
  const [statusChange, setStatusChange] = useState<{ active: boolean } | null>(null);

  // Fetch promotions
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['promotions'],
    queryFn: async () => {
      const res = await fetch('/api/store/promotions');
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? `Failed to fetch promotions (${res.status})`);
      }
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
  // ARGUS #329: "active" means live at this instant, not merely isActive.
  const liveCounts = summarizePromotionLiveStates(promotions);
  const activeCount = liveCounts.live;
  const promoCodeCount = promotions.filter((promotion) => promotion.type === 'PROMO_CODE').length;
  const hygiene = auditPromotions(promotions);

  // ARGUS #334: search/status filter and pagination over the loaded page.
  const [search, setSearch] = useState('');
  const [liveFilter, setLiveFilter] = useState<'ALL' | PromotionLiveState>('ALL');
  const [page, setPage] = useState(1);

  const filteredPromotions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return promotions.filter((promotion) => {
      if (liveFilter !== 'ALL' && getPromotionLiveState(promotion) !== liveFilter) {
        return false;
      }
      if (!needle) return true;
      return (
        promotion.name.toLowerCase().includes(needle) ||
        (promotion.promoCode ?? '').toLowerCase().includes(needle) ||
        (PROMOTION_TYPE_LABELS[promotion.type] ?? promotion.type)
          .toLowerCase()
          .includes(needle)
      );
    });
  }, [promotions, search, liveFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPromotions.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedPromotions = filteredPromotions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

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
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error?.message ?? 'Failed to update status');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Deactivate is a DELETE that always means off (idempotent server-side).
  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/store/promotions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to deactivate');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      setStatusChange(null);
      setEditPromo(null);
      toast.success('Promotion deactivated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Activate is an explicit status-only PATCH (writes PROMOTION_ACTIVATED).
  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/store/promotions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) throw new Error('Failed to activate');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      setStatusChange(null);
      setEditPromo(null);
      toast.success('Promotion activated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-espresso">Promotions</h1>
          <p className="font-body text-sm text-mist-ink">
            {activeCount} live promotion{activeCount !== 1 ? 's' : ''} now
          </p>
          <p className="mt-1 max-w-2xl font-body text-xs text-mist-ink">
            Stacking: product/category/BOGO promotions apply first (one per line), then the
            best cart promotion on the remainder, then a promo code on what is left. The
            combined discount can never exceed the cart subtotal.
          </p>
          {(hygiene.openEnded.length > 0 || hygiene.missingTarget.length > 0) && (
            <div className="mt-2 max-w-2xl rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 font-body text-xs text-amber-900">
              {hygiene.openEnded.length > 0 && (
                <p>
                  {hygiene.openEnded.length} active promotion
                  {hygiene.openEnded.length !== 1 ? 's have' : ' has'} no start or end
                  date and appl{hygiene.openEnded.length !== 1 ? 'y' : 'ies'} until deactivated.
                  Confirm this is intended or add a window.
                </p>
              )}
              {hygiene.missingTarget.length > 0 && (
                <p>
                  {hygiene.missingTarget.length} BOGO/Mix promotion
                  {hygiene.missingTarget.length !== 1 ? 's have' : ' has'} no product or
                  category target and will never apply.
                </p>
              )}
            </div>
          )}
        </div>
        {canCreate && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-espresso text-pearl hover:bg-espresso/90 font-body gap-1.5">
                <Plus className="h-4 w-4" />
                New Promotion
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
        )}
      </div>

      {/* M15-01 (BUG-46): the customer pricing tab sits beside the promotion
          list so customer-specific prices are reachable from the same page. */}
      <Tabs defaultValue="promotions" className="gap-4">
        <TabsList>
          <TabsTrigger value="promotions" className="font-body px-3">
            Promotions
          </TabsTrigger>
          {canManageCustomerPricing && (
            <TabsTrigger value="customer-pricing" className="font-body px-3">
              Customer Pricing
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="promotions" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-mist/30 bg-pearl p-4">
              <p className="font-body text-xs uppercase tracking-wide text-mist-ink">Active now</p>
              <p className="mt-2 font-display text-2xl text-espresso">{activeCount}</p>
              <p className="mt-1 text-sm text-sand-ink">Enabled or inside their date window right now.</p>
            </div>
            <div className="rounded-xl border border-mist/30 bg-pearl p-4">
              <p className="font-body text-xs uppercase tracking-wide text-mist-ink">Scheduled</p>
              <p className="mt-2 font-display text-2xl text-espresso">{liveCounts.scheduled}</p>
              <p className="mt-1 text-sm text-sand-ink">Starts in the future; not applying yet.</p>
            </div>
            <div className="rounded-xl border border-mist/30 bg-pearl p-4">
              <p className="font-body text-xs uppercase tracking-wide text-mist-ink">Promo codes</p>
              <p className="mt-2 font-display text-2xl text-espresso">{promoCodeCount}</p>
              <p className="mt-1 text-sm text-sand-ink">
                Codes customers type at checkout. Each is also listed as its own promotion.
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-mist-ink" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search by name, code or type"
                aria-label="Search promotions"
                className="border-mist pl-8 font-body"
              />
            </div>
            <Select
              value={liveFilter}
              onValueChange={(value) => {
                setLiveFilter(value as 'ALL' | PromotionLiveState);
                setPage(1);
              }}
            >
              <SelectTrigger
                className="w-48 border-mist font-body"
                aria-label="Filter promotions by live status"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {(Object.keys(PROMOTION_LIVE_STATE_LABELS) as PromotionLiveState[]).map(
                  (state) => (
                    <SelectItem key={state} value={state}>
                      {PROMOTION_LIVE_STATE_LABELS[state]}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            <span className="font-body text-xs text-mist-ink">
              {filteredPromotions.length} of {promotions.length} shown
            </span>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="rounded-lg border border-[#9B2226]/30 bg-[#9B2226]/5 p-6">
              <p className="font-body text-sm text-[#9B2226]">
                Promotions could not be loaded. {error instanceof Error ? error.message : 'Try again.'}
              </p>
              <Button
                variant="outline"
                className="mt-3 font-body"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                {isFetching ? 'Retrying...' : 'Retry'}
              </Button>
            </div>
          ) : filteredPromotions.length === 0 ? (
            <div className="text-center py-16">
              <p className="font-body text-mist-ink">
                {promotions.length === 0
                  ? 'No promotions yet. Create one to get started.'
                  : 'No promotions match these filters.'}
              </p>
              {promotions.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 font-body"
                  onClick={() => {
                    setSearch('');
                    setLiveFilter('ALL');
                    setPage(1);
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <div className="border border-mist/30 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-linen/50">
                    <TableHead className="font-body text-xs text-mist-ink font-medium">Name</TableHead>
                    <TableHead className="font-body text-xs text-mist-ink font-medium">Type</TableHead>
                    <TableHead className="font-body text-xs text-mist-ink font-medium">Value</TableHead>
                    <TableHead className="font-body text-xs text-mist-ink font-medium">Promo Code</TableHead>
                    <TableHead className="font-body text-xs text-mist-ink font-medium">Status</TableHead>
                    <TableHead className="font-body text-xs text-mist-ink font-medium">Valid Window</TableHead>
                    <TableHead className="font-body text-xs text-mist-ink font-medium">Usage</TableHead>
                    <TableHead className="font-body text-xs text-mist-ink font-medium">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedPromotions.map((promo) => {
                    const liveState = getPromotionLiveState(promo);
                    return (
                    <TableRow key={promo.id} className="hover:bg-linen/30">
                      <TableCell className="font-body text-sm text-espresso font-medium">
                        <div>{promo.name}</div>
                        {(promo.type === 'PRODUCT_PERCENTAGE' || promo.type === 'PRODUCT_FIXED' || promo.type === 'BOGO' || promo.type === 'MIX_AND_MATCH') && promo.targetProduct && (
                          <div className="mt-0.5 text-xs font-normal text-mist-ink">Product: {promo.targetProduct.name}</div>
                        )}
                        {(promo.type === 'CATEGORY_PERCENTAGE' || promo.type === 'BOGO' || promo.type === 'MIX_AND_MATCH') && promo.targetCategory && (
                          <div className="mt-0.5 text-xs font-normal text-mist-ink">Category: {promo.targetCategory.name}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`font-body text-xs ${getTypeBadgeClasses(promo.type)}`}>
                          {PROMOTION_TYPE_LABELS[promo.type] ?? promo.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-espresso">
                        {formatValue(promo.type, promo.value)}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-mist-ink">
                        {promo.type === 'PROMO_CODE' && promo.promoCode ? promo.promoCode : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          {canEdit && (
                            <Switch
                              checked={promo.isActive}
                              onCheckedChange={(checked) =>
                                toggleMutation.mutate({ id: promo.id, isActive: checked })
                              }
                              aria-label={`${
                                promo.isActive ? 'Deactivate' : 'Activate'
                              } ${promo.name}`}
                            />
                          )}
                          <Badge
                            variant="secondary"
                            className={`font-body text-xs ${getLiveStateBadgeClasses(liveState)}`}
                          >
                            {PROMOTION_LIVE_STATE_LABELS[liveState]}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-body text-xs text-mist-ink">
                        {formatDateRange(promo.startsAt, promo.endsAt)}
                      </TableCell>
                      <TableCell className="font-body text-xs text-mist-ink">
                        {promo.usageCount ?? 0} sale{(promo.usageCount ?? 0) === 1 ? '' : 's'}
                      </TableCell>
                      <TableCell>
                        {canEdit ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditPromo(promo)}
                            className="text-terracotta hover:text-espresso gap-1"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                        ) : (
                          <span className="font-body text-xs text-mist-ink">View only</span>
                        )}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {!isLoading && !isError && filteredPromotions.length > 0 && (
            <div className="flex items-center justify-end gap-2">
              <span className="font-body text-xs text-mist-ink">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="font-body"
                disabled={currentPage <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="font-body"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Edit Sheet */}
          <Sheet open={!!editPromo} onOpenChange={(open) => { if (!open) setEditPromo(null); }}>
            <SheetContent className="overflow-y-auto sm:max-w-xl">
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
                      targetProductId: editPromo.targetProductId ?? undefined,
                      minQuantity: editPromo.minQuantity ?? undefined,
                      startsAt: editPromo.startsAt ? editPromo.startsAt.slice(0, 10) : undefined,
                      endsAt: editPromo.endsAt ? editPromo.endsAt.slice(0, 10) : undefined,
                      description: editPromo.description ?? undefined,
                    }}
                    categories={categories}
                    selectedProductLabel={editPromo.targetProduct?.name}
                    onSubmit={(data) => updateMutation.mutate({ id: editPromo.id, data })}
                    isSubmitting={updateMutation.isPending}
                    submitLabel="Save Changes"
                  />
                  <div className="border-t border-mist/30 pt-4">
                    {editPromo.isActive ? (
                      canDelete ? (
                        <Button
                          variant="ghost"
                          className="w-full text-[#9B2226] hover:text-[#9B2226]/80 hover:bg-[#9B2226]/5 font-body"
                          onClick={() => setStatusChange({ active: false })}
                        >
                          Deactivate Promotion
                        </Button>
                      ) : null
                    ) : canEdit ? (
                      <Button
                        variant="ghost"
                        className="w-full text-green-700 hover:text-green-800 hover:bg-green-50 font-body"
                        onClick={() => setStatusChange({ active: true })}
                      >
                        Activate Promotion
                      </Button>
                    ) : null}
                  </div>
                </div>
              )}
            </SheetContent>
          </Sheet>

          <Dialog
            open={statusChange !== null}
            onOpenChange={(open) => {
              if (!open) setStatusChange(null);
            }}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display text-espresso">
                  {statusChange?.active ? 'Activate promotion?' : 'Deactivate promotion?'}
                </DialogTitle>
                <DialogDescription className="font-body text-mist-ink">
                  {statusChange?.active
                    ? 'The promotion will apply again at checkout according to its schedule.'
                    : 'The promotion will stop applying immediately. Activate it again later if needed.'}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setStatusChange(null)}
                  disabled={deactivateMutation.isPending || activateMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  className={
                    statusChange?.active
                      ? 'bg-green-700 text-white hover:bg-green-800'
                      : 'bg-[#9B2226] text-white hover:bg-[#9B2226]/90'
                  }
                  onClick={() => {
                    if (!statusChange || !editPromo) return;
                    if (statusChange.active) activateMutation.mutate(editPromo.id);
                    else deactivateMutation.mutate(editPromo.id);
                  }}
                  disabled={deactivateMutation.isPending || activateMutation.isPending}
                >
                  {statusChange?.active ? 'Activate Promotion' : 'Deactivate Promotion'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="customer-pricing">
          <CustomerPricingTab canCreate={canCreate} canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
