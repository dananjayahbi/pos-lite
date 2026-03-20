'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { toast } from 'sonner';
import { Search, Plus, Minus, Lock, Loader2, ChevronRight } from 'lucide-react';
import { StockMovementReason } from '@/generated/prisma/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ── Types ────────────────────────────────────────────────────────────────────

interface ProductSearchResult {
  id: string;
  name: string;
  category?: { name: string } | null;
  brand?: { name: string } | null;
  isArchived: boolean;
}

interface VariantData {
  id: string;
  sku: string | null;
  barcode: string | null;
  size: string | null;
  colour: string | null;
  stockQuantity: number;
  lowStockThreshold: number;
  costPrice: string;
  retailPrice: string;
}

// ── Reason labels ────────────────────────────────────────────────────────────

const REASON_LABELS: Record<StockMovementReason, string> = {
  [StockMovementReason.FOUND]: 'Found',
  [StockMovementReason.DAMAGED]: 'Damaged',
  [StockMovementReason.STOLEN]: 'Stolen',
  [StockMovementReason.DATA_ERROR]: 'Data Error',
  [StockMovementReason.RETURNED_TO_SUPPLIER]: 'Returned to Supplier',
  [StockMovementReason.INITIAL_STOCK]: 'Initial Stock',
  [StockMovementReason.SALE_RETURN]: 'Sale Return',
  [StockMovementReason.PURCHASE_RECEIVED]: 'Purchase Received',
  [StockMovementReason.STOCK_TAKE_ADJUSTMENT]: 'Stock Take Adjustment',
  [StockMovementReason.SALE]: 'Sale',
  [StockMovementReason.VOID_REVERSAL]: 'Void Reversal',
};

// ── Form schema ──────────────────────────────────────────────────────────────

const FormSchema = z.object({
  productId: z.string().min(1, { error: 'Select a product' }),
  variantId: z.string().min(1, { error: 'Select a variant' }),
  adjustmentType: z.enum(['add', 'remove'], { error: 'Select adjustment type' }),
  quantity: z.number().int().min(1, { error: 'Min quantity is 1' }),
  reason: z.nativeEnum(StockMovementReason, { error: 'Select a reason' }),
  note: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof FormSchema>;

// ── Component ────────────────────────────────────────────────────────────────

interface StockAdjustmentFormProps {
  permissions: string[];
}

export function StockAdjustmentForm({ permissions }: StockAdjustmentFormProps) {
  // Permission check
  if (!permissions.includes('stock:adjust')) {
    return (
      <div className="space-y-6">
        <Breadcrumb />
        <Card className="border-sand/40">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Lock className="h-12 w-12 text-mist" />
            <h2 className="font-display text-xl font-semibold text-espresso">
              Permission Denied
            </h2>
            <p className="font-body text-sm text-mist">
              You do not have permission to make stock adjustments.
            </p>
            <Link
              href="/stock-control"
              className="font-body text-sm font-medium text-terracotta underline-offset-2 hover:underline"
            >
              ← Back to Stock Control
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <AdjustmentFormInner />;
}

// ── Breadcrumb ───────────────────────────────────────────────────────────────

function Breadcrumb() {
  return (
    <nav className="flex items-center gap-1 font-body text-sm text-mist">
      <Link href="/dashboard" className="hover:text-espresso">
        Dashboard
      </Link>
      <ChevronRight className="h-3.5 w-3.5" />
      <Link href="/stock-control" className="hover:text-espresso">
        Stock Control
      </Link>
      <ChevronRight className="h-3.5 w-3.5" />
      <span className="text-espresso">Manual Adjustment</span>
    </nav>
  );
}

// ── Inner form (only rendered when permitted) ────────────────────────────────

function AdjustmentFormInner() {
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductSearchResult | null>(null);
  const [variants, setVariants] = useState<VariantData[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<VariantData | null>(null);
  const [isLoadingVariants, setIsLoadingVariants] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(FormSchema),
    defaultValues: {
      productId: '',
      variantId: '',
      note: '',
    },
  });

  const adjustmentType = form.watch('adjustmentType');
  const quantity = form.watch('quantity');
  const noteValue = form.watch('note') ?? '';

  // ── Derived state ──────────────────────────────────────────────────────────

  const currentStock = selectedVariant?.stockQuantity ?? 0;
  const delta =
    adjustmentType && quantity
      ? adjustmentType === 'add'
        ? quantity
        : -quantity
      : 0;
  const projectedStock = currentStock + delta;
  const wouldGoNegative = projectedStock < 0;

  // ── Product search with debounce ───────────────────────────────────────────

  const searchProducts = useCallback(async (term: string) => {
    if (term.length < 1) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/store/products?search=${encodeURIComponent(term)}&limit=10`,
      );
      const json = await res.json();
      if (json.success) {
        setSearchResults(json.data ?? []);
      }
    } catch {
      // silently fail search
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (productSearch.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      searchProducts(productSearch.trim());
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [productSearch, searchProducts]);

  // ── Select a product → fetch variants ──────────────────────────────────────

  const handleSelectProduct = async (product: ProductSearchResult) => {
    setSelectedProduct(product);
    setPopoverOpen(false);
    setProductSearch('');
    setSearchResults([]);
    setSelectedVariant(null);
    setVariants([]);
    form.setValue('productId', product.id, { shouldValidate: true });
    form.setValue('variantId', '');

    setIsLoadingVariants(true);
    try {
      const res = await fetch(`/api/store/products/${product.id}`);
      const json = await res.json();
      if (json.success && json.data?.variants) {
        setVariants(json.data.variants);
      }
    } catch {
      toast.error('Failed to load variants');
    } finally {
      setIsLoadingVariants(false);
    }
  };

  // ── Select a variant ───────────────────────────────────────────────────────

  const handleSelectVariant = (variantId: string) => {
    const v = variants.find((vr) => vr.id === variantId);
    setSelectedVariant(v ?? null);
    form.setValue('variantId', variantId, { shouldValidate: true });
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const onSubmit = async (values: FormValues) => {
    const quantityDelta =
      values.adjustmentType === 'add' ? values.quantity : -values.quantity;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/store/stock-control/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: values.variantId,
          quantityDelta,
          reason: values.reason,
          note: values.note || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? 'Failed to adjust stock');
        return;
      }

      toast.success(
        `Stock updated from ${json.data.quantityBefore} to ${json.data.quantityAfter} units.`,
      );

      // Low stock warning toast
      if (json.data.lowStockTriggered) {
        toast.warning(
          `${json.data.productName} — ${json.data.sku} is low on stock. Current stock: ${json.data.quantityAfter}`,
          {
            action: {
              label: 'View Low Stock →',
              onClick: () => {
                window.location.href = '/stock-control/low-stock';
              },
            },
            duration: 8000,
          },
        );
      }

      // Reset form
      form.reset();
      setSelectedProduct(null);
      setSelectedVariant(null);
      setVariants([]);
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <Breadcrumb />

      <div>
        <h1 className="font-display text-2xl font-bold text-espresso">
          Manual Stock Adjustment
        </h1>
        <p className="mt-1 font-body text-sm text-mist">
          Add or remove inventory with a reason for audit tracking.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit as never)} className="space-y-6">
        <Card className="border-sand/40">
          <CardHeader>
            <CardTitle className="font-display text-lg text-espresso">
              Select Product &amp; Variant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Product Search */}
            <div className="space-y-2">
              <Label className="font-body text-sm font-medium text-espresso">
                Product
              </Label>

              {selectedProduct ? (
                <div className="flex items-center justify-between rounded-md border border-sand/40 bg-linen/50 px-3 py-2">
                  <div>
                    <p className="font-body text-sm font-medium text-espresso">
                      {selectedProduct.name}
                    </p>
                    {selectedProduct.category && (
                      <p className="font-body text-xs text-mist">
                        {selectedProduct.category.name}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedProduct(null);
                      setSelectedVariant(null);
                      setVariants([]);
                      form.setValue('productId', '');
                      form.setValue('variantId', '');
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist" />
                      <Input
                        placeholder="Search products by name, SKU, or barcode…"
                        value={productSearch}
                        onChange={(e) => {
                          setProductSearch(e.target.value);
                          if (!popoverOpen && e.target.value.trim().length > 0) {
                            setPopoverOpen(true);
                          }
                        }}
                        onFocus={() => {
                          if (productSearch.trim().length > 0) setPopoverOpen(true);
                        }}
                        className="pl-9"
                      />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] p-0"
                    align="start"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    {isSearching ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-mist" />
                        <span className="ml-2 font-body text-sm text-mist">Searching…</span>
                      </div>
                    ) : searchResults.length === 0 ? (
                      <p className="px-3 py-4 text-center font-body text-sm text-mist">
                        {productSearch.trim().length > 0
                          ? 'No products found'
                          : 'Type to search products'}
                      </p>
                    ) : (
                      <ul className="max-h-60 overflow-y-auto py-1">
                        {searchResults.map((p) => (
                          <li key={p.id}>
                            <button
                              type="button"
                              className="flex w-full flex-col px-3 py-2 text-left hover:bg-linen/60"
                              onClick={() => handleSelectProduct(p)}
                            >
                              <span className="font-body text-sm font-medium text-espresso">
                                {p.name}
                              </span>
                              {p.category && (
                                <span className="font-body text-xs text-mist">
                                  {p.category.name}
                                  {p.brand ? ` · ${p.brand.name}` : ''}
                                </span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </PopoverContent>
                </Popover>
              )}
              {form.formState.errors.productId && (
                <p className="font-body text-xs text-red-600">
                  {form.formState.errors.productId.message}
                </p>
              )}
            </div>

            {/* Variant Select */}
            <div className="space-y-2">
              <Label className="font-body text-sm font-medium text-espresso">
                Variant
              </Label>

              {isLoadingVariants ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-mist" />
                  <span className="font-body text-sm text-mist">Loading variants…</span>
                </div>
              ) : (
                <Select
                  disabled={!selectedProduct || variants.length === 0}
                  value={form.watch('variantId') || ''}
                  onValueChange={handleSelectVariant}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={selectedProduct ? 'Select variant' : 'Select a product first'} />
                  </SelectTrigger>
                  <SelectContent>
                    {variants.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        <span className="font-mono text-xs">{v.sku ?? '—'}</span>
                        <span className="ml-1">
                          — {v.size ?? '—'} / {v.colour ?? '—'}
                        </span>
                        <span className="ml-1 text-mist">
                          (Stock: {v.stockQuantity})
                        </span>
                        {v.stockQuantity === 0 && (
                          <span className="ml-1 text-xs text-red-600">Out of stock</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {form.formState.errors.variantId && (
                <p className="font-body text-xs text-red-600">
                  {form.formState.errors.variantId.message}
                </p>
              )}

              {/* Current stock badge */}
              {selectedVariant && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="font-body text-xs text-mist">Current stock:</span>
                  <Badge
                    className={
                      selectedVariant.stockQuantity === 0
                        ? 'bg-red-100 text-red-800 hover:bg-red-100'
                        : selectedVariant.stockQuantity <= selectedVariant.lowStockThreshold
                          ? 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                          : 'bg-green-100 text-green-800 hover:bg-green-100'
                    }
                  >
                    {selectedVariant.stockQuantity} units
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-sand/40">
          <CardHeader>
            <CardTitle className="font-display text-lg text-espresso">
              Adjustment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Adjustment Type Toggle */}
            <div className="space-y-2">
              <Label className="font-body text-sm font-medium text-espresso">
                Adjustment Type
              </Label>
              <div className="flex gap-3">
                <button
                  type="button"
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 font-body text-sm font-medium transition-colors ${
                    adjustmentType === 'add'
                      ? 'border-green-600 bg-green-50 text-green-700'
                      : 'border-sand/40 text-mist hover:border-green-400 hover:bg-green-50/50'
                  }`}
                  onClick={() =>
                    form.setValue('adjustmentType', 'add', { shouldValidate: true })
                  }
                >
                  <Plus className="h-5 w-5" />
                  Add Stock
                </button>
                <button
                  type="button"
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 font-body text-sm font-medium transition-colors ${
                    adjustmentType === 'remove'
                      ? 'border-red-600 bg-red-50 text-red-700'
                      : 'border-sand/40 text-mist hover:border-red-400 hover:bg-red-50/50'
                  }`}
                  onClick={() =>
                    form.setValue('adjustmentType', 'remove', { shouldValidate: true })
                  }
                >
                  <Minus className="h-5 w-5" />
                  Remove Stock
                </button>
              </div>
              {form.formState.errors.adjustmentType && (
                <p className="font-body text-xs text-red-600">
                  {form.formState.errors.adjustmentType.message}
                </p>
              )}
            </div>

            {/* Quantity */}
            <div className="space-y-2">
              <Label className="font-body text-sm font-medium text-espresso">
                {adjustmentType === 'remove' ? 'Quantity to Remove' : 'Quantity to Add'}
              </Label>
              <Input
                type="number"
                min={1}
                placeholder="Enter quantity"
                {...form.register('quantity', { valueAsNumber: true })}
              />
              {form.formState.errors.quantity && (
                <p className="font-body text-xs text-red-600">
                  {form.formState.errors.quantity.message}
                </p>
              )}
              {quantity > 999 && (
                <p className="font-body text-xs text-amber-600">
                  Large adjustment — please double-check the quantity.
                </p>
              )}

              {/* Live preview */}
              {selectedVariant && adjustmentType && quantity > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="font-body text-xs text-mist">Stock after adjustment:</span>
                  <span
                    className={`font-body text-sm font-semibold ${
                      wouldGoNegative
                        ? 'text-red-600'
                        : projectedStock === 0
                          ? 'text-amber-600'
                          : 'text-green-600'
                    }`}
                  >
                    {projectedStock} units
                  </span>
                </div>
              )}
              {wouldGoNegative && (
                <p className="font-body text-xs text-red-600">
                  Cannot reduce stock below zero. Current stock is {currentStock}.
                </p>
              )}
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label className="font-body text-sm font-medium text-espresso">
                Reason
              </Label>
              <Select
                value={form.watch('reason') || undefined}
                onValueChange={(val) =>
                  form.setValue('reason', val as StockMovementReason, {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(StockMovementReason).map((r) => (
                    <SelectItem key={r} value={r}>
                      {REASON_LABELS[r]}
                      {r === StockMovementReason.STOCK_TAKE_ADJUSTMENT && (
                        <span className="ml-1 text-xs text-mist">(used by stock takes)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.reason && (
                <p className="font-body text-xs text-red-600">
                  {form.formState.errors.reason.message}
                </p>
              )}
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label className="font-body text-sm font-medium text-espresso">
                Note <span className="font-normal text-mist">(optional)</span>
              </Label>
              <Textarea
                placeholder="Add any additional details about this adjustment…"
                maxLength={500}
                {...form.register('note')}
              />
              <p className="text-right font-body text-xs text-mist">
                {noteValue.length}/500
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex flex-col gap-3">
          <Button
            type="submit"
            disabled={isSubmitting || wouldGoNegative}
            className="w-full bg-espresso text-pearl hover:bg-espresso/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing…
              </>
            ) : (
              'Submit Adjustment'
            )}
          </Button>
          <p className="text-center font-body text-xs text-mist">
            Adjustments are permanent. Use a follow-up adjustment to correct mistakes.
          </p>
        </div>
      </form>
    </div>
  );
}
