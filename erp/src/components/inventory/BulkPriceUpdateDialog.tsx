'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useInventorySelectionStore } from '@/stores/inventorySelectionStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

type Mode = 'fixed' | 'percent';
type Direction = 'INCREASE' | 'DECREASE';
type Target = 'COST' | 'RETAIL' | 'BOTH';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedProductIds: string[];
}

interface FixedFormData {
  costPrice: string;
  retailPrice: string;
}

interface PercentFormData {
  percentage: string;
}

export function BulkPriceUpdateDialog({ isOpen, onClose, selectedProductIds }: Props) {
  const [mode, setMode] = useState<Mode>('fixed');
  const [direction, setDirection] = useState<Direction>('INCREASE');
  const [target, setTarget] = useState<Target>('BOTH');

  const clearSelection = useInventorySelectionStore((s) => s.clearSelection);
  const queryClient = useQueryClient();

  const fixedForm = useForm<FixedFormData>({
    defaultValues: { costPrice: '', retailPrice: '' },
  });

  const percentForm = useForm<PercentFormData>({
    defaultValues: { percentage: '' },
  });

  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/store/products/bulk-price-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error?.message ?? 'Bulk update failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      const { updated, errors } = data.data;
      toast.success(`Updated ${updated} variant${updated !== 1 ? 's' : ''}${errors > 0 ? ` (${errors} failed)` : ''}`);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      clearSelection();
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleFixedSubmit = fixedForm.handleSubmit((data) => {
    const cost = parseFloat(data.costPrice);
    const retail = parseFloat(data.retailPrice);

    if (isNaN(cost) || cost <= 0) {
      fixedForm.setError('costPrice', { message: 'Must be a positive number' });
      return;
    }
    if (isNaN(retail) || retail <= 0) {
      fixedForm.setError('retailPrice', { message: 'Must be a positive number' });
      return;
    }

    mutation.mutate({
      productIds: selectedProductIds,
      mode: 'FIXED',
      costPrice: cost,
      retailPrice: retail,
    });
  });

  const handlePercentSubmit = percentForm.handleSubmit((data) => {
    const pct = parseInt(data.percentage, 10);

    if (isNaN(pct) || pct < 1 || pct > 200) {
      percentForm.setError('percentage', { message: 'Must be between 1 and 200' });
      return;
    }

    mutation.mutate({
      productIds: selectedProductIds,
      mode: 'PERCENT',
      percentage: pct,
      direction,
      target,
    });
  });

  const count = selectedProductIds.length;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="font-display text-espresso">
            Bulk Price Update
          </DialogTitle>
          <p className="font-body text-sm text-mist">
            Update prices for {count} selected product{count !== 1 ? 's' : ''}
          </p>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex gap-1 rounded-lg bg-linen p-1">
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-2 font-body text-sm font-medium transition-colors ${
              mode === 'fixed'
                ? 'bg-espresso text-pearl shadow-sm'
                : 'text-mist hover:text-espresso'
            }`}
            onClick={() => setMode('fixed')}
          >
            Set Fixed Price
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-2 font-body text-sm font-medium transition-colors ${
              mode === 'percent'
                ? 'bg-espresso text-pearl shadow-sm'
                : 'text-mist hover:text-espresso'
            }`}
            onClick={() => setMode('percent')}
          >
            Apply % Change
          </button>
        </div>

        {/* Fixed mode */}
        {mode === 'fixed' && (
          <form onSubmit={handleFixedSubmit} className="space-y-4">
            <div className="rounded-lg border border-terracotta/30 bg-terracotta/5 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-terracotta mt-0.5 shrink-0" />
              <p className="font-body text-xs text-terracotta">
                This will overwrite the cost and retail price of all variants under the selected products.
              </p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="fixed-cost" className="font-body text-espresso">
                  Cost Price
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-mist">
                    Rs.
                  </span>
                  <Input
                    id="fixed-cost"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="pl-10 border-sand"
                    {...fixedForm.register('costPrice')}
                  />
                </div>
                {fixedForm.formState.errors.costPrice && (
                  <p className="font-body text-xs text-red-500">
                    {fixedForm.formState.errors.costPrice.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fixed-retail" className="font-body text-espresso">
                  Retail Price
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-mist">
                    Rs.
                  </span>
                  <Input
                    id="fixed-retail"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    className="pl-10 border-sand"
                    {...fixedForm.register('retailPrice')}
                  />
                </div>
                {fixedForm.formState.errors.retailPrice && (
                  <p className="font-body text-xs text-red-500">
                    {fixedForm.formState.errors.retailPrice.message}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="border-sand text-espresso"
                onClick={onClose}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-espresso text-pearl hover:bg-espresso/90"
                disabled={mutation.isPending}
              >
                {mutation.isPending
                  ? 'Updating…'
                  : `Apply to All ${count} Product${count !== 1 ? 's' : ''}`}
              </Button>
            </DialogFooter>
          </form>
        )}

        {/* Percentage mode */}
        {mode === 'percent' && (
          <form onSubmit={handlePercentSubmit} className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="pct-value" className="font-body text-espresso">
                  Percentage
                </Label>
                <div className="relative">
                  <Input
                    id="pct-value"
                    type="number"
                    min="1"
                    max="200"
                    placeholder="10"
                    className="pr-8 border-sand"
                    {...percentForm.register('percentage')}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-body text-sm text-mist">
                    %
                  </span>
                </div>
                {percentForm.formState.errors.percentage && (
                  <p className="font-body text-xs text-red-500">
                    {percentForm.formState.errors.percentage.message}
                  </p>
                )}
              </div>

              {/* Direction toggle */}
              <div className="space-y-1.5">
                <Label className="font-body text-espresso">Direction</Label>
                <div className="flex gap-1 rounded-lg bg-linen p-1">
                  <button
                    type="button"
                    className={`flex-1 rounded-md px-3 py-1.5 font-body text-sm font-medium transition-colors ${
                      direction === 'INCREASE'
                        ? 'bg-espresso text-pearl shadow-sm'
                        : 'text-mist hover:text-espresso'
                    }`}
                    onClick={() => setDirection('INCREASE')}
                  >
                    Increase
                  </button>
                  <button
                    type="button"
                    className={`flex-1 rounded-md px-3 py-1.5 font-body text-sm font-medium transition-colors ${
                      direction === 'DECREASE'
                        ? 'bg-espresso text-pearl shadow-sm'
                        : 'text-mist hover:text-espresso'
                    }`}
                    onClick={() => setDirection('DECREASE')}
                  >
                    Decrease
                  </button>
                </div>
              </div>

              {/* Target toggle */}
              <div className="space-y-1.5">
                <Label className="font-body text-espresso">Apply To</Label>
                <div className="flex gap-1 rounded-lg bg-linen p-1">
                  {(['COST', 'RETAIL', 'BOTH'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`flex-1 rounded-md px-3 py-1.5 font-body text-sm font-medium transition-colors ${
                        target === t
                          ? 'bg-espresso text-pearl shadow-sm'
                          : 'text-mist hover:text-espresso'
                      }`}
                      onClick={() => setTarget(t)}
                    >
                      {t === 'COST' ? 'Cost Price' : t === 'RETAIL' ? 'Retail Price' : 'Both'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="border-sand text-espresso"
                onClick={onClose}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-espresso text-pearl hover:bg-espresso/90"
                disabled={mutation.isPending}
              >
                {mutation.isPending
                  ? 'Updating…'
                  : `Apply to All ${count} Product${count !== 1 ? 's' : ''}`}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
