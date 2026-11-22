'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { toast } from 'sonner';
import { Search, Plus, Minus, Lock, Loader2, ChevronRight } from 'lucide-react';
import {
  MANUAL_ADJUSTMENT_REASONS,
  MANUAL_ADJUSTMENT_REASON_LABELS,
  isManualReasonDirectionValid,
  manualAdjustmentDirectionError,
  validManualReasonsForDirection,
  type ManualAdjustmentDirection,
  type ManualAdjustmentReason,
} from '@/lib/services/manualAdjustment.core';
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
import { useVariantPrefill } from '@/hooks/useVariantPrefill';
import { useInvalidateStockQueries } from '@/hooks/useInvalidateStockQueries';

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
  form: string | null;
  packSize: string | null;
  stockQuantity: number;
  lowStockThreshold: number;
  costPrice: string;
  retailPrice: string;
}

// ── Reason labels ────────────────────────────────────────────────────────────

// ARGUS #189: labels come from the movement-ledger map so the form and the
// ledger cannot disagree about the same reason.
const REASON_LABELS = MANUAL_ADJUSTMENT_REASON_LABELS;

// ── Form schema ──────────────────────────────────────────────────────────────

const FormSchema = z
  .object({
    productId: z.string().min(1, { error: 'Select a product' }),
    variantId: z.string().min(1, { error: 'Select a variant' }),
    adjustmentType: z.enum(['add', 'remove'], { error: 'Select adjustment type' }),
    quantity: z.number().int().min(1, { error: 'Min quantity is 1' }),
    reason: z.enum(MANUAL_ADJUSTMENT_REASONS, { error: 'Select a reason' }),
    note: z.string().max(500).optional(),
  })
  .superRefine((values, ctx) => {
    // ARGUS #193: Damaged/Stolen/Returned to Supplier are removal-only and
    // Found/Data Error work either way. The same rule runs server-side.
    const directionError = manualAdjustmentDirectionError(
      values.reason,
      values.adjustmentType === 'add' ? 1 : -1,
    );
    if (directionError) {
      ctx.addIssue({ code: 'custom', path: ['reason'], message: directionError });
    }
  });

type FormValues = z.infer<typeof FormSchema>;

// ── Component ────────────────────────────────────────────────────────────────

interface StockAdjustmentFormProps {
  permissions: string[];
  prefillVariantId?: string | null;
}

export function StockAdjustmentForm({ permissions, prefillVariantId }: StockAdjustmentFormProps) {
  // Permission check
  if (!permissions.includes('stock:adjust')) {
    return (
      <div className="space-y-6">
        <Breadcrumb />
        <Card className="border-sand/40">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Lock className="h-12 w-12 text-mist-ink" />
            <h2 className="font-display text-xl font-semibold text-espresso">
              Permission Denied
            </h2>
            <p className="font-body text-sm text-mist-ink">
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

  return (
    <AdjustmentFormInner prefillVariantId={prefillVariantId ?? null} />
  );
}

// ── Breadcrumb ───────────────────────────────────────────────────────────────

function Breadcrumb() {
  return (
    <nav className="flex items-center gap-1 font-body text-sm text-mist-ink">
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

function AdjustmentFormInner({ prefillVariantId }: { prefillVariantId?: string | null }) {
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  // ARGUS #196: distinguish a failed search from "no matches" and let the
  // operator page beyond the first page of results.
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchLimit, setSearchLimit] = useState(10);
  // M09-03 (OBS-18): highlighted result index for keyboard/scanner selection
  // inside the search popover. Enter selects it instead of dismissing.
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<ProductSearchResult | null>(null);
  const [variants, setVariants] = useState<VariantData[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<VariantData | null>(null);
  const [isLoadingVariants, setIsLoadingVariants] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // ARGUS #194: refresh every cache a successful adjustment touches.
  const invalidateStockQueries = useInvalidateStockQueries();

  // Resolve variantId query param → product + variant (from Low Stock record)
  const {
    product: prefilledProduct,
    variant: prefilledVariant,
    isLoading: isPrefilling,
    error: prefillError,
  } = useVariantPrefill(prefillVariantId ?? null);

  // Locked when arriving from a record (variantId present in URL).
  // Stays locked while resolving; unlocks only if resolution fails.
  const isLocked = Boolean(prefillVariantId) && !prefillError;

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

  // ARGUS #193: the reason list follows the selected direction, so an invalid
  // pairing (positive Damaged, negative Found, …) cannot be chosen at all.
  const direction: ManualAdjustmentDirection | null = adjustmentType ?? null;
  const validReasons = direction
    ? validManualReasonsForDirection(direction)
    : MANUAL_ADJUSTMENT_REASONS;

  const setAdjustmentType = (next: ManualAdjustmentDirection) => {
    form.setValue('adjustmentType', next, { shouldValidate: true });
    const currentReason = form.getValues('reason');
    if (
      currentReason &&
      !isManualReasonDirectionValid(currentReason, next === 'add' ? 1 : -1)
    ) {
      form.resetField('reason');
    }
  };

  // ── Apply prefill once resolved ────────────────────────────────────────────

  useEffect(() => {
    if (!prefilledProduct || !prefilledVariant) return;

    setSelectedProduct({
      id: prefilledProduct.id,
      name: prefilledProduct.name,
      category: prefilledProduct.category ?? null,
      brand: prefilledProduct.brand ?? null,
      isArchived: prefilledProduct.isArchived ?? false,
    });
    setSelectedVariant({
      ...prefilledVariant,
      costPrice: '0',
      retailPrice: '0',
    });
    setVariants([
      {
        ...prefilledVariant,
        costPrice: '0',
        retailPrice: '0',
      },
    ]);
    form.setValue('productId', prefilledProduct.id, { shouldValidate: true });
    form.setValue('variantId', prefilledVariant.id, { shouldValidate: true });
  }, [prefilledProduct, prefilledVariant, form]);

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

  const searchProducts = useCallback(async (term: string, limit = 10): Promise<ProductSearchResult[]> => {
    if (term.length < 1) {
      setSearchResults([]);
      setSearchError(null);
      return [];
    }
    setIsSearching(true);
    setSearchError(null);
    try {
      // ARGUS #196: archived products cannot be adjusted from this picker.
      // Only live products are offered, and the API still owns tenant scope.
      const res = await fetch(
        `/api/store/products?search=${encodeURIComponent(term)}&status=active&limit=${limit}`,
      );
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setSearchError(
          json?.error?.message ?? 'Product search failed. Check the connection and retry.',
        );
        setSearchResults([]);
        return [];
      }
      const results: ProductSearchResult[] = json.data ?? [];
      setSearchResults(results);
      return results;
    } catch {
      setSearchError('Product search failed. Check the connection and retry.');
      setSearchResults([]);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchError(null);
    setSearchLimit(10);
    if (productSearch.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      searchProducts(productSearch.trim(), 10);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [productSearch, searchProducts]);

  // Reset the keyboard highlight whenever the result set changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [searchResults]);

  // ARGUS #196: page through the picker instead of silently capping at 10.
  const handleShowMore = () => {
    const term = productSearch.trim();
    if (!term) return;
    const next = Math.min(searchLimit + 10, 50);
    setSearchLimit(next);
    void searchProducts(term, next);
  };

  // ── Scanner/keyboard resolve: Enter selects the highlighted result ─────────
  // M09-03 (OBS-18): a hardware scanner terminates its keystroke burst with
  // Enter. Previously that Enter dismissed the Radix popover (and triggered
  // implicit form submission) without selecting anything. Now Enter selects
  // the highlighted result — defaulting to the top hit — and if the burst
  // outran the 300 ms debounce, the search is flushed immediately first.
  // Escape keeps its default dismiss behaviour.
  const handleSearchKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') return; // let Radix dismiss
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (searchResults.length === 0) return;
      e.preventDefault();
      setPopoverOpen(true);
      setActiveIndex((i) => {
        const n = searchResults.length;
        return e.key === 'ArrowDown' ? (i + 1) % n : (i - 1 + n) % n;
      });
      return;
    }
    if (e.key !== 'Enter') return;
    e.preventDefault(); // never submit the form from the search field
    const term = productSearch.trim();
    if (!term) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const pool =
      searchResults.length > 0 ? searchResults : await searchProducts(term);
    if (pool.length === 0) return;
    const pick = (searchResults.length > 0 ? pool[activeIndex] : pool[0]) ?? pool[0];
    if (!pick) return;
    await handleSelectProduct(pick);
  };

  // ── Select a product → fetch variants ──────────────────────────────────────

  const handleSelectProduct = async (product: ProductSearchResult) => {
    setSelectedProduct(product);
    setPopoverOpen(false);
    setProductSearch('');
    setSearchResults([]);
    setActiveIndex(0);
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
          `${json.data.productName} - ${json.data.sku} is low on stock. Current stock: ${json.data.quantityAfter}`,
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

      // ARGUS #194: product, low-stock, summary, valuation and movement
      // screens all cache this figure. Invalidate before resetting so the
      // Low Stock action target (and the current page's widgets) refetch
      // instead of showing pre-adjustment numbers for 30 s - 5 min.
      try {
        await invalidateStockQueries();
      } catch {
        // The adjustment is already committed; a cache refresh failure must
        // not turn success into a network-error toast.
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
    <div className="space-y-6 p-6 md:p-8">
      <Breadcrumb />

      <div>
        <h1 className="font-display text-2xl font-bold text-espresso">
          Manual Stock Adjustment
        </h1>
        <p className="mt-1 font-body text-sm text-mist-ink">
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
            {/* Prefill loading / error states */}
            {isPrefilling && (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-mist-ink" />
                <span className="font-body text-sm text-mist-ink">
                  Loading product from record…
                </span>
              </div>
            )}
            {prefillError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
                <p className="font-body text-sm text-red-700">{prefillError}</p>
                <p className="mt-1 font-body text-xs text-red-600">
                  You can still search for a product manually below.
                </p>
              </div>
            )}

            {/* Product Search */}
            <div className="space-y-2">
              <Label className="font-body text-sm font-medium text-espresso">
                Product
              </Label>

              {selectedProduct ? (
                <div
                  className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                    isLocked
                      ? 'border-sand/60 bg-sand/20'
                      : 'border-sand/40 bg-linen/50'
                  }`}
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-body text-sm font-medium text-espresso">
                        {selectedProduct.name}
                      </p>
                      {selectedProduct.isArchived && (
                        <Badge
                          variant="secondary"
                          className="bg-gray-100 text-gray-700 hover:bg-gray-100"
                        >
                          Archived
                        </Badge>
                      )}
                    </div>
                    {selectedProduct.category && (
                      <p className="font-body text-xs text-mist-ink">
                        {selectedProduct.category.name}
                      </p>
                    )}
                    {selectedProduct.isArchived && (
                      <p className="mt-1 font-body text-xs text-amber-700">
                        This product is archived. Adjust it only to correct existing stock;
                        archived products cannot be sold.
                      </p>
                    )}
                  </div>
                  {isLocked ? (
                    <span className="flex items-center gap-1.5 font-body text-xs font-medium text-mist-ink">
                      <Lock className="h-3.5 w-3.5" />
                      Locked to record
                    </span>
                  ) : (
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
                  )}
                </div>
              ) : (
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                  <PopoverTrigger asChild>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist-ink" />
                      <Input
                        placeholder="Search products by name, SKU, or barcode…"
                        value={productSearch}
                        onChange={(e) => {
                          setProductSearch(e.target.value);
                          if (!popoverOpen && e.target.value.trim().length > 0) {
                            setPopoverOpen(true);
                          }
                        }}
                        onKeyDown={(e) => {
                          void handleSearchKeyDown(e);
                        }}
                        onFocus={() => {
                          if (productSearch.trim().length > 0) setPopoverOpen(true);
                        }}
                        className="pl-9"
                      />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-(--radix-popover-trigger-width) p-0"
                    align="start"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    {isSearching ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-mist-ink" />
                        <span className="ml-2 font-body text-sm text-mist-ink">Searching…</span>
                      </div>
                    ) : searchError ? (
                      <div role="alert" className="space-y-2 px-3 py-4 text-center">
                        <p className="font-body text-sm font-medium text-red-700">
                          Product search failed
                        </p>
                        <p className="font-body text-xs text-red-600">{searchError}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-red-200 text-red-700 hover:bg-red-50"
                          onClick={() => void searchProducts(productSearch.trim(), searchLimit)}
                        >
                          Retry
                        </Button>
                      </div>
                    ) : searchResults.length === 0 ? (
                      <p className="px-3 py-4 text-center font-body text-sm text-mist-ink">
                        {productSearch.trim().length > 0
                          ? 'No active products found'
                          : 'Type to search products'}
                      </p>
                    ) : (
                      <>
                        <ul className="max-h-60 overflow-y-auto py-1">
                          {searchResults.map((p, i) => (
                            <li key={p.id}>
                              <button
                                type="button"
                                data-highlighted={i === activeIndex ? '' : undefined}
                                className={`flex w-full flex-col px-3 py-2 text-left hover:bg-linen/60 ${
                                  i === activeIndex ? 'bg-linen/80' : ''
                                }`}
                                onMouseEnter={() => setActiveIndex(i)}
                                onClick={() => handleSelectProduct(p)}
                              >
                                <span className="font-body text-sm font-medium text-espresso">
                                  {p.name}
                                </span>
                                {(p.category || p.isArchived) && (
                                  <span className="font-body text-xs text-mist-ink">
                                    {p.category?.name}
                                    {p.category && p.brand ? ' · ' : ''}
                                    {p.brand ? p.brand.name : ''}
                                    {p.isArchived ? ' · Archived' : ''}
                                  </span>
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                        {searchResults.length >= searchLimit && searchLimit < 50 && (
                          <div className="border-t border-sand/40 p-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="w-full text-xs"
                              onClick={handleShowMore}
                            >
                              Show more results
                            </Button>
                          </div>
                        )}
                      </>
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

              {isPrefilling ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-mist-ink" />
                  <span className="font-body text-sm text-mist-ink">Loading record…</span>
                </div>
              ) : isLoadingVariants ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-mist-ink" />
                  <span className="font-body text-sm text-mist-ink">Loading variants…</span>
                </div>
              ) : isLocked && selectedVariant ? (
                // Locked variant chip (arrived from a Low Stock record)
                <div className="rounded-md border border-sand/40 bg-linen/50 px-3 py-2">
                  <p className="font-mono text-xs text-espresso">{selectedVariant.sku ?? '-'}</p>
                  <p className="font-body text-xs text-mist-ink">
                    {selectedVariant.form ?? '-'} / {selectedVariant.packSize ?? '-'} · Stock:{' '}
                    {selectedVariant.stockQuantity}
                  </p>
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
                        <span className="font-mono text-xs">{v.sku ?? '-'}</span>
                        <span className="ml-1">
                          - {v.form ?? '-'} / {v.packSize ?? '-'}
                        </span>
                        <span className="ml-1 text-mist-ink">
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
                  <span className="font-body text-xs text-mist-ink">Current stock:</span>
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
                      : 'border-sand/40 text-mist-ink hover:border-green-400 hover:bg-green-50/50'
                  }`}
                  onClick={() =>
                    setAdjustmentType('add')
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
                      : 'border-sand/40 text-mist-ink hover:border-red-400 hover:bg-red-50/50'
                  }`}
                  onClick={() =>
                    setAdjustmentType('remove')
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
                  Large adjustment - please double-check the quantity.
                </p>
              )}

              {/* Live preview */}
              {selectedVariant && adjustmentType && quantity > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="font-body text-xs text-mist-ink">Stock after adjustment:</span>
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
                  form.setValue('reason', val as ManualAdjustmentReason, {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {validReasons.map((r) => (
                    <SelectItem key={r} value={r}>
                      {REASON_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.reason && (
                <p className="font-body text-xs text-red-600">
                  {form.formState.errors.reason.message}
                </p>
              )}
              <p className="font-body text-[11px] text-mist-ink">
                {direction === 'add'
                  ? 'Adding stock allows Found or Data Error.'
                  : direction === 'remove'
                    ? 'Removing stock allows Found, Data Error, Damaged, Stolen or Returned to Supplier.'
                    : 'Choose Add or Remove to see the valid reasons.'}
              </p>
            </div>

            {/* Note */}
            <div className="space-y-2">
              <Label className="font-body text-sm font-medium text-espresso">
                Note <span className="font-normal text-mist-ink">(optional)</span>
              </Label>
              <Textarea
                placeholder="Add any additional details about this adjustment…"
                maxLength={500}
                {...form.register('note')}
              />
              <p className="text-right font-body text-xs text-mist-ink">
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
          <p className="text-center font-body text-xs text-mist-ink">
            Adjustments are permanent. Use a follow-up adjustment to correct mistakes.
          </p>
        </div>
      </form>
    </div>
  );
}
