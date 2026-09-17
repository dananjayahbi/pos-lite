'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { Switch } from '@/components/ui/switch';
import type { CustomerPricingRuleDraft } from './customerPricing.types';
import { useVariantOptions, type VariantOption } from './useVariantOptions';

/**
 * M15-01 (BUG-46) — "Add rule" dialog for customer pricing.
 *
 * Contract notes, kept in sync with `CreateCustomerPricingRuleSchema`:
 *  - `variantId` is optional — an empty selection POSTs as '' which the schema
 *    normalizes to undefined → NULL, i.e. "applies to every variant";
 *  - `startsAt`/`endsAt` are optional and an untouched date input already
 *    submits '' which the schema turns into undefined → NULL (open-ended);
 *  - `price` is the flat per-unit customer price and only reduces a line when
 *    it is BELOW the line unit price (evaluation semantics).
 * Validation feedback comes from the API (400 VALIDATION_ERROR), so the dialog
 * only guards the two things it can check locally: blank tag and blank/NaN price.
 */

const EMPTY_DRAFT: CustomerPricingRuleDraft = {
  customerTag: '',
  variantId: '',
  price: '',
  startsAt: '',
  endsAt: '',
  isActive: true,
};

interface AddCustomerPricingRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: CustomerPricingRuleDraft) => void;
  isSubmitting: boolean;
}

export function AddCustomerPricingRuleDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: AddCustomerPricingRuleDialogProps) {
  const { data: variants = [] } = useVariantOptions();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-espresso">Add Customer Pricing Rule</DialogTitle>
          <DialogDescription>
            Give customers carrying a tag a fixed per-unit price for one variant (or every
            variant). The rule only lowers a line when its price is below the normal selling price.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each session starts from a clean draft
            without an effect resetting state mid-render. */}
        <CustomerPricingRuleForm
          variants={variants}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
}

interface CustomerPricingRuleFormProps {
  variants: VariantOption[];
  onSubmit: (draft: CustomerPricingRuleDraft) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

function CustomerPricingRuleForm({
  variants,
  onSubmit,
  onCancel,
  isSubmitting,
}: CustomerPricingRuleFormProps) {
  const [draft, setDraft] = useState<CustomerPricingRuleDraft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<CustomerPricingRuleDraft>) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const tag = draft.customerTag.trim();
    if (tag === '') {
      setError('Customer tag is required.');
      return;
    }
    const price = Number(draft.price.trim());
    if (draft.price.trim() === '' || !Number.isFinite(price) || price <= 0) {
      setError('Price must be a number greater than 0.');
      return;
    }
    if (draft.startsAt && draft.endsAt && draft.endsAt <= draft.startsAt) {
      setError('End date must be after the start date.');
      return;
    }
    setError(null);
    onSubmit({ ...draft, customerTag: tag });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cp-tag">Customer tag</Label>
            <Input
              id="cp-tag"
              value={draft.customerTag}
              onChange={(e) => update({ customerTag: e.target.value })}
              placeholder="e.g. WHOLESALE"
              maxLength={60}
              className="font-mono uppercase"
            />
            <p className="text-xs text-mist">
              Matches the tag stored on the customer record exactly.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cp-variant">Variant</Label>
            <select
              id="cp-variant"
              value={draft.variantId}
              onChange={(e) => update({ variantId: e.target.value })}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="">All variants (no variant restriction)</option>
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cp-price">Customer price (Rs.)</Label>
            <Input
              id="cp-price"
              type="number"
              step="0.01"
              min="0"
              value={draft.price}
              onChange={(e) => update({ price: e.target.value })}
              className="font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cp-starts">Valid from</Label>
              <Input
                id="cp-starts"
                type="date"
                value={draft.startsAt}
                onChange={(e) => update({ startsAt: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-ends">Valid to</Label>
              <Input
                id="cp-ends"
                type="date"
                value={draft.endsAt}
                onChange={(e) => update({ endsAt: e.target.value })}
              />
            </div>
          </div>
          <p className="text-xs text-mist">
            Leave both dates blank for an open-ended rule.
          </p>

          <div className="flex items-center justify-between rounded-lg border border-mist/40 px-3 py-2">
            <div>
              <Label htmlFor="cp-active" className="text-sm text-espresso">Active</Label>
              <p className="text-xs text-mist">Inactive rules never apply to a cart.</p>
            </div>
            <Switch
              id="cp-active"
              checked={draft.isActive}
              onCheckedChange={(checked) => update({ isActive: checked })}
            />
          </div>

          {error ? <p className="text-xs text-[#9B2226]">{error}</p> : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-espresso text-pearl hover:bg-espresso/90"
            >
              {isSubmitting ? 'Saving...' : 'Create Rule'}
            </Button>
          </DialogFooter>
    </form>
  );
}