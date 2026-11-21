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
import { formatRupee } from '@/lib/format';
import { canonicalCustomerTag, type CustomerTagOption } from '@/lib/services/customerTag.core';
import { windowIssues } from '@/lib/services/promotionWindow.core';
import type { CustomerPricingRuleDraft, CustomerPricingRuleRow } from './customerPricing.types';
import { useVariantOptions, type VariantOption } from './useVariantOptions';
import { useCustomerTagOptions } from './useCustomerTagOptions';

/**
 * M15-01 (BUG-46) + ARGUS #333 — create/edit dialog for customer pricing.
 *
 * Contract notes, kept in sync with the customer-pricing schema/routes:
 *  - the customer tag is canonical upper-case and chosen from tags actually
 *    carried by customers (the API rejects an unknown tag);
 *  - `variantId` is optional — an empty selection means "every variant";
 *  - `startsAt`/`endsAt` are inclusive local days and a same-day rule is
 *    valid;
 *  - a variant-specific price must not exceed that variant's retail price
 *    (the engine never applies a rule at or above the cart unit price);
 *  - the same form edits an existing rule (PATCH) and creates a new one.
 */

const EMPTY_DRAFT: CustomerPricingRuleDraft = {
  customerTag: '',
  variantId: '',
  price: '',
  startsAt: '',
  endsAt: '',
  isActive: true,
};

function draftFromRule(rule: CustomerPricingRuleRow): CustomerPricingRuleDraft {
  return {
    customerTag: canonicalCustomerTag(rule.customerTag),
    variantId: rule.variantId ?? '',
    price: String(rule.price),
    startsAt: rule.startsAt ? rule.startsAt.slice(0, 10) : '',
    endsAt: rule.endsAt ? rule.endsAt.slice(0, 10) : '',
    isActive: rule.isActive,
  };
}

interface AddCustomerPricingRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: CustomerPricingRuleDraft) => void;
  isSubmitting: boolean;
  /** When set, the dialog edits this rule instead of creating a new one. */
  rule?: CustomerPricingRuleRow | null;
}

export function AddCustomerPricingRuleDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  rule = null,
}: AddCustomerPricingRuleDialogProps) {
  const { data: variants = [] } = useVariantOptions();
  const { data: tags = [], isLoading: tagsLoading } = useCustomerTagOptions(open);
  const isEditing = rule !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-espresso">
            {isEditing ? 'Edit Customer Pricing Rule' : 'Add Customer Pricing Rule'}
          </DialogTitle>
          <DialogDescription>
            Give customers carrying a tag a fixed per-unit price for one variant (or every
            variant). The rule only lowers a line when its price is below the normal selling price.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each session starts from a clean draft
            without an effect resetting state mid-render. Keyed by rule id so
            switching between create/edit remounts with the right values. */}
        <CustomerPricingRuleForm
          key={rule?.id ?? 'new'}
          variants={variants}
          tags={tags}
          tagsLoading={tagsLoading}
          rule={rule}
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
  tags: CustomerTagOption[];
  tagsLoading: boolean;
  rule: CustomerPricingRuleRow | null;
  onSubmit: (draft: CustomerPricingRuleDraft) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

function CustomerPricingRuleForm({
  variants,
  tags,
  tagsLoading,
  rule,
  onSubmit,
  onCancel,
  isSubmitting,
}: CustomerPricingRuleFormProps) {
  const [draft, setDraft] = useState<CustomerPricingRuleDraft>(() =>
    rule ? draftFromRule(rule) : EMPTY_DRAFT,
  );
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<CustomerPricingRuleDraft>) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  const selectedVariant = variants.find((variant) => variant.id === draft.variantId);
  const retailPrice = selectedVariant ? Number(selectedVariant.retailPrice) : null;
  const tagOptions = draft.customerTag && !tags.some((tag) => tag.tag === draft.customerTag)
    ? [draft.customerTag, ...tags.map((tag) => tag.tag)]
    : tags.map((tag) => tag.tag);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const tag = canonicalCustomerTag(draft.customerTag);
    if (tag === '') {
      setError('Select a customer tag.');
      return;
    }
    const price = Number(draft.price.trim());
    if (draft.price.trim() === '' || !Number.isFinite(price) || price <= 0) {
      setError('Price must be a number greater than 0.');
      return;
    }
    if (
      retailPrice !== null &&
      Number.isFinite(retailPrice) &&
      price > retailPrice
    ) {
      setError(`Price cannot be above the variant retail price (${formatRupee(retailPrice)}).`);
      return;
    }
    const dateIssues = windowIssues(draft.startsAt, draft.endsAt);
    if (dateIssues.length > 0) {
      setError(dateIssues[0]!.message);
      return;
    }
    setError(null);
    onSubmit({ ...draft, customerTag: tag });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="cp-tag">Customer tag</Label>
        <select
          id="cp-tag"
          value={draft.customerTag}
          onChange={(e) => update({ customerTag: canonicalCustomerTag(e.target.value) })}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm font-mono uppercase shadow-sm"
          disabled={tagsLoading}
        >
          <option value="">{tagsLoading ? 'Loading customer tags...' : 'Select a customer tag'}</option>
          {tagOptions.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
        <p className="text-xs text-mist-ink">
          Tags come from customers. Values are stored upper-case, so "wholesale" and
          "WHOLESALE" are the same tag.
        </p>
        {!tagsLoading && tags.length === 0 && draft.customerTag === '' && (
          <p className="text-xs text-[#9B2226]">
            No customer has a tag yet. Add a tag on a customer first.
          </p>
        )}
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
        {retailPrice !== null && Number.isFinite(retailPrice) && (
          <p className="text-xs text-mist-ink">
            Retail price: {formatRupee(retailPrice)}. The rule must be at or below this.
          </p>
        )}
        {draft.variantId === '' && (
          <p className="text-xs text-mist-ink">
            With no variant selected, the price is checked against each cart line at evaluation
            time.
          </p>
        )}
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
      <p className="text-xs text-mist-ink">
        Dates are inclusive local days. Leave both blank for an open-ended rule; a same-day
        window is valid.
      </p>

      <div className="flex items-center justify-between rounded-lg border border-mist/40 px-3 py-2">
        <div>
          <Label htmlFor="cp-active" className="text-sm text-espresso">Active</Label>
          <p className="text-xs text-mist-ink">Inactive rules never apply to a cart.</p>
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
          {isSubmitting ? 'Saving...' : rule ? 'Save Changes' : 'Create Rule'}
        </Button>
      </DialogFooter>
    </form>
  );
}
