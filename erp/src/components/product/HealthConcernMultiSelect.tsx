'use client';

import type { HealthConcern } from '@/generated/prisma/client';
import {
  HEALTH_CONCERNS,
  HEALTH_CONCERN_LABELS,
} from '@/lib/constants/health-concerns';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface HealthConcernMultiSelectProps {
  value: HealthConcern[];
  onChange: (next: HealthConcern[]) => void;
  idPrefix?: string;
}

/**
 * Controlled checkbox-group for assigning `HealthConcern` tags to a product.
 * Used by both the create wizard (step 1) and the edit product sheet. Deliberately
 * NOT wired via react-hook-form `register` — arrays registered that way throw
 * variance errors under `exactOptionalPropertyTypes`, so the host form drives it
 * as a controlled component through `value` / `onChange`.
 */
export function HealthConcernMultiSelect({
  value,
  onChange,
  idPrefix = 'health-concern',
}: HealthConcernMultiSelectProps) {
  const toggle = (concern: HealthConcern, checked: boolean) => {
    const next = checked
      ? [...value, concern]
      : value.filter((c) => c !== concern);
    onChange(next);
  };

  return (
    <div className="space-y-4 rounded-lg border border-sand/30 bg-linen/40 p-4">
      <p className="font-body text-xs font-semibold uppercase tracking-wider text-mist">
        Health Concerns (shown on storefront)
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {HEALTH_CONCERNS.map((concern, i) => {
          const hc = concern as unknown as HealthConcern;
          const checked = value.includes(hc);
          const id = `${idPrefix}-${i}`;
          return (
            <div key={concern} className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={checked}
                onCheckedChange={(checkedState) => toggle(hc, checkedState === true)}
              />
              <Label
                htmlFor={id}
                className="font-body text-sm font-normal text-espresso"
              >
                {HEALTH_CONCERN_LABELS[concern]}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
