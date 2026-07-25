"use client";

/**
 * Reusable +/− quantity stepper used inside the cart drawer and the
 * full-page cart. Purely controlled — the parent owns the quantity value.
 */

import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuantityStepperProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  size?: 'sm' | 'md';
  className?: string;
  ariaLabel?: string;
}

export function QuantityStepper({
  value,
  min = 1,
  max = 999,
  onChange,
  size = 'md',
  className,
  ariaLabel = 'Quantity',
}: QuantityStepperProps) {
  const atMin = value <= min;
  const atMax = value >= max;

  const dims =
    size === 'sm'
      ? 'h-7 w-7 text-xs'
      : 'h-9 w-9 text-sm';

  return (
    <div
      className={cn(
        'inline-flex items-center rounded border border-gray-300 bg-white',
        className,
      )}
      role="group"
      aria-label={ariaLabel}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={atMin}
        aria-label="Decrease quantity"
        className={cn(
          dims,
          'flex items-center justify-center text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40',
          'rounded-l',
        )}
      >
        <Minus size={size === 'sm' ? 12 : 14} />
      </button>
      <span
        className={cn(
          'min-w-[2.25rem] border-x border-gray-300 px-2 text-center font-medium tabular-nums',
          size === 'sm' ? 'text-xs' : 'text-sm',
        )}
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={atMax}
        aria-label="Increase quantity"
        className={cn(
          dims,
          'flex items-center justify-center text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40',
          'rounded-r',
        )}
      >
        <Plus size={size === 'sm' ? 12 : 14} />
      </button>
    </div>
  );
}