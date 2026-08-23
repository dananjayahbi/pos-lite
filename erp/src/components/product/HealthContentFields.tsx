'use client';

import type { UseFormRegisterReturn } from 'react-hook-form';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

/**
 * Reusable set of Ayurvedic health-content textareas for product create/edit
 * forms. Renders labeled multi-line inputs for Active Ingredients, Usage
 * Instructions, Health Benefits, and Safety Precautions. Kept as a single
 * presentational component so the edit sheet and the create wizard share one
 * consistent, structured layout for these fields.
 */
interface HealthContentFieldsProps {
  /** Binds the four fields to the host form's register. */
  register: (name: 'activeIngredients' | 'usageInstructions' | 'healthBenefits' | 'safetyPrecautions') => UseFormRegisterReturn;
}

export function HealthContentFields({ register }: HealthContentFieldsProps) {
  return (
    <div className="space-y-4 rounded-lg border border-sand/30 bg-linen/40 p-4">
      <p className="font-body text-xs font-semibold uppercase tracking-wider text-mist">
        Health Information (shown on storefront)
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="hc-ingredients" className="font-body text-sm text-espresso">
          Active Ingredients
        </Label>
        <Textarea
          id="hc-ingredients"
          placeholder="e.g. Ashwagandha root extract, Black pepper…"
          rows={3}
          className="border-sand"
          {...register('activeIngredients')}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="hc-usage" className="font-body text-sm text-espresso">
          Usage Instructions
        </Label>
        <Textarea
          id="hc-usage"
          placeholder="e.g. Take 1 teaspoon twice daily after meals…"
          rows={3}
          className="border-sand"
          {...register('usageInstructions')}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="hc-benefits" className="font-body text-sm text-espresso">
          Health Benefits
        </Label>
        <Textarea
          id="hc-benefits"
          placeholder="e.g. Supports joint mobility and reduces stress…"
          rows={3}
          className="border-sand"
          {...register('healthBenefits')}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="hc-precautions" className="font-body text-sm text-espresso">
          Safety Precautions
        </Label>
        <Textarea
          id="hc-precautions"
          placeholder="e.g. Not recommended during pregnancy…"
          rows={3}
          className="border-sand"
          {...register('safetyPrecautions')}
        />
      </div>
    </div>
  );
}
