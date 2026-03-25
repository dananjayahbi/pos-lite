'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { formatRupee } from '@/lib/format';
import Decimal from 'decimal.js';
import { CreatePOSchema, type CreatePOInput } from '@/lib/validators/purchaseOrder.validators';

// ── Types ────────────────────────────────────────────────────────────────────

interface SupplierOption {
  id: string;
  name: string;
}

interface VariantSearchResult {
  id: string;
  sku: string;
  size?: string | null;
  colour?: string | null;
  costPrice: string | number;
  stockQuantity: number;
  product: { name: string };
}

// ── Variant Search Input ─────────────────────────────────────────────────────

interface VariantSearchProps {
  index: number;
  onSelect: (variant: VariantSearchResult) => void;
}

function VariantSearchInput({ index, onSelect }: VariantSearchProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data } = useQuery<{ success: boolean; data: VariantSearchResult[] }>({
    queryKey: ['variant-search', debouncedSearch],
    queryFn: () =>
      fetch(`/api/store/variants/search?search=${encodeURIComponent(debouncedSearch)}`).then((r) =>
        r.json(),
      ),
    enabled: debouncedSearch.length >= 1,
  });

  const results = data?.data ?? [];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = useCallback(
    (variant: VariantSearchResult) => {
      onSelect(variant);
      setSearch('');
      setDebouncedSearch('');
      setOpen(false);
    },
    [onSelect],
  );

  const variantLabel = (v: VariantSearchResult) => {
    const parts = [v.product.name];
    if (v.size) parts.push(v.size);
    if (v.colour) parts.push(v.colour);
    return parts.join(' – ');
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        placeholder={`Search product or SKU for line ${index + 1}…`}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (search.length > 0) setOpen(true);
        }}
      />
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-sand/30 bg-pearl shadow-lg max-h-60 overflow-y-auto">
          {results.map((v) => (
            <button
              key={v.id}
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-linen text-left"
              onClick={() => handleSelect(v)}
            >
              <div>
                <p className="font-medium text-espresso">{variantLabel(v)}</p>
                <p className="text-xs text-mist">
                  SKU: {v.sku} · Stock: {v.stockQuantity}
                </p>
              </div>
              <span className="font-mono text-xs text-mist">
                {formatRupee(v.costPrice)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  // Fetch suppliers
  const { data: suppliersData } = useQuery<{ success: boolean; data: { suppliers: SupplierOption[] } }>({
    queryKey: ['suppliers-dropdown'],
    queryFn: () =>
      fetch('/api/store/suppliers?limit=100').then((r) => r.json()),
  });
  const suppliers = suppliersData?.data?.suppliers ?? [];

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreatePOInput>({
    resolver: standardSchemaResolver(CreatePOSchema),
    defaultValues: {
      supplierId: '',
      lines: [],
      expectedDeliveryDate: undefined,
      notes: undefined,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  });

  const watchedLines = watch('lines');

  // Running total
  const runningTotal = (watchedLines ?? []).reduce((acc, line) => {
    if (!line.orderedQty || !line.expectedCostPrice) return acc;
    return acc.plus(new Decimal(line.expectedCostPrice).times(line.orderedQty));
  }, new Decimal(0));

  // Track selected variant names for display
  const [lineLabels, setLineLabels] = useState<Record<number, string>>({});

  const handleVariantSelect = useCallback(
    (index: number, variant: VariantSearchResult) => {
      const label = [variant.product.name, variant.size, variant.colour]
        .filter(Boolean)
        .join(' – ');
      setLineLabels((prev) => ({ ...prev, [index]: label }));

      // Update the field array values
      setValue(`lines.${index}.variantId`, variant.id);
      setValue(
        `lines.${index}.expectedCostPrice`,
        Number(new Decimal(variant.costPrice.toString()).toFixed(2)),
      );
    },
    [setValue],
  );

  const addLine = useCallback(() => {
    append({ variantId: '', orderedQty: 1, expectedCostPrice: 0 });
  }, [append]);

  const onSubmit = async (data: CreatePOInput) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/store/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();

      if (!json.success) {
        toast.error(json.error?.message ?? 'Failed to create purchase order');
        return;
      }

      toast.success('Purchase order created');
      router.push(`/suppliers/purchase-orders/${json.data.id}`);
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-6 md:p-8">
      <h1 className="font-display text-2xl font-semibold text-espresso">New Purchase Order</h1>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Form Fields */}
          <div className="space-y-6 lg:col-span-2">
            {/* Supplier + Date */}
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-1.5">
                  <Label htmlFor="supplierId">Supplier *</Label>
                  <Select
                    value={watch('supplierId')}
                    onValueChange={(v) => setValue('supplierId', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.supplierId && (
                    <p className="text-sm text-red-600">{errors.supplierId.message}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="expectedDeliveryDate">Expected Delivery Date</Label>
                  <Input
                    id="expectedDeliveryDate"
                    type="date"
                    {...register('expectedDeliveryDate')}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    {...register('notes')}
                    placeholder="Additional notes"
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Lines */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Order Lines</span>
                  <Button type="button" variant="outline" size="sm" onClick={addLine}>
                    <Plus className="mr-1 h-4 w-4" />
                    Add Line
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.length === 0 && (
                  <p className="text-sm text-mist py-4 text-center">
                    No lines added yet. Click &quot;Add Line&quot; to start.
                  </p>
                )}
                {errors.lines?.root && (
                  <p className="text-sm text-red-600">{errors.lines.root.message}</p>
                )}
                {errors.lines?.message && (
                  <p className="text-sm text-red-600">{errors.lines.message}</p>
                )}

                {fields.map((field, index) => (
                  <div key={field.id} className="rounded-lg border border-sand/30 bg-pearl/60 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-espresso">
                        Line {index + 1}
                        {lineLabels[index] && (
                          <span className="ml-2 font-normal text-mist">
                            — {lineLabels[index]}
                          </span>
                        )}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          remove(index);
                          setLineLabels((prev) => {
                            const next = { ...prev };
                            delete next[index];
                            return next;
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>

                    {/* Variant Search */}
                    {!watchedLines?.[index]?.variantId && (
                      <VariantSearchInput
                        index={index}
                        onSelect={(v) => handleVariantSelect(index, v)}
                      />
                    )}

                    <input type="hidden" {...register(`lines.${index}.variantId`)} />

                    {errors.lines?.[index]?.variantId && (
                      <p className="text-sm text-red-600">
                        {errors.lines[index].variantId.message}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Ordered Qty</Label>
                        <Input
                          type="number"
                          min={1}
                          {...register(`lines.${index}.orderedQty`, { valueAsNumber: true })}
                        />
                        {errors.lines?.[index]?.orderedQty && (
                          <p className="text-sm text-red-600">
                            {errors.lines[index].orderedQty.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label>Expected Cost Price</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          {...register(`lines.${index}.expectedCostPrice`, {
                            valueAsNumber: true,
                          })}
                        />
                        {errors.lines?.[index]?.expectedCostPrice && (
                          <p className="text-sm text-red-600">
                            {errors.lines[index].expectedCostPrice.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right: Summary */}
          <div>
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(watchedLines ?? []).length === 0 ? (
                  <p className="text-sm text-mist">No lines added</p>
                ) : (
                  <>
                    {(watchedLines ?? []).map((line, i) => {
                      const label = lineLabels[i] ?? `Line ${i + 1}`;
                      const qty = line.orderedQty || 0;
                      const cost = line.expectedCostPrice || 0;
                      const lineTotal = new Decimal(cost).times(qty);
                      return (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="truncate max-w-[60%] text-espresso">{label}</span>
                          <span className="font-mono">
                            {qty} × {formatRupee(cost)}
                          </span>
                        </div>
                      );
                    })}
                    <div className="border-t border-sand/30 pt-3">
                      <div className="flex items-center justify-between font-semibold">
                        <span>Total</span>
                        <span className="font-mono">{formatRupee(runningTotal.toFixed(2))}</span>
                      </div>
                    </div>
                  </>
                )}

                <Button
                  type="submit"
                  disabled={submitting || fields.length === 0}
                  className="w-full mt-4"
                >
                  {submitting ? 'Creating…' : 'Create Purchase Order'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
