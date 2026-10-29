'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PODiscountType } from './poTypes';

/**
 * Percentage-or-fixed discount with a type toggle.
 *
 * The value is kept as a raw string so a half-typed "1." or "" doesn't collapse
 * to `0` mid-edit; the caller parses it for the live summary.
 */
interface PODiscountFieldProps {
  type: PODiscountType | null;
  value: string;
  onTypeChange: (type: PODiscountType | null) => void;
  onValueChange: (value: string) => void;
  error?: string | undefined;
  disabled?: boolean | undefined;
}

const TYPE_OPTIONS: Array<{ value: PODiscountType; label: string }> = [
  { value: 'PERCENTAGE', label: '% off' },
  { value: 'FIXED', label: 'Fixed amount' },
];

export function PODiscountField({
  type,
  value,
  onTypeChange,
  onValueChange,
  error,
  disabled,
}: PODiscountFieldProps) {
  // Selecting the already-active type toggles the discount off entirely, which
  // is the only way back to "no discount" without a third radio button.
  const handleType = (next: PODiscountType) => {
    if (type === next) {
      onTypeChange(null);
      onValueChange('');
      return;
    }
    onTypeChange(next);
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor="po-discount-value">Discount</Label>
      <div className="flex gap-2">
        <div className="flex gap-1" role="group" aria-label="Discount type">
          {TYPE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={type === option.value ? 'default' : 'outline'}
              aria-pressed={type === option.value}
              onClick={() => handleType(option.value)}
              disabled={disabled}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <Input
          id="po-discount-value"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          max={type === 'PERCENTAGE' ? 100 : undefined}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={type === 'PERCENTAGE' ? '0' : '0.00'}
          className="w-28 font-mono"
          disabled={disabled || type === null}
        />
        <span className="self-center text-sm text-mist">
          {type === 'PERCENTAGE' ? '%' : type === 'FIXED' ? 'Rs.' : ''}
        </span>
      </div>
      <p className="text-xs text-mist">
        {type === null
          ? 'No discount — click a type to apply one.'
          : type === 'PERCENTAGE'
            ? 'Applied to the subtotal, capped at 100%.'
            : 'Capped so the payable never goes below zero.'}
      </p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
