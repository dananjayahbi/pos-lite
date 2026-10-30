'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

import { addDays, formatPoDate } from './poDates';

/**
 * Payment terms for a purchase order.
 *
 * Stored as `paymentTermDays` (30 / 10 / `null` for immediate). The due date is
 * derived from the order date so the operator sees when the money is actually
 * owed before saving.
 */

export type PaymentTermValue = 30 | 10 | null;

interface TermOption {
  value: PaymentTermValue;
  label: string;
  hint: string;
}

const TERM_OPTIONS: TermOption[] = [
  { value: 30, label: '1 month', hint: '30 days' },
  { value: 10, label: '10 days', hint: '10 days' },
  { value: null, label: 'Immediate', hint: 'due on receipt' },
];

interface POPaymentTermsFieldProps {
  value: PaymentTermValue;
  onChange: (value: PaymentTermValue) => void;
  /** Local `yyyy-mm-dd` order date the due date is computed from. */
  orderDate: string;
  disabled?: boolean | undefined;
}

export function POPaymentTermsField({
  value,
  onChange,
  orderDate,
  disabled,
}: POPaymentTermsFieldProps) {
  const dueDay = orderDate && value !== null ? addDays(orderDate, value) : undefined;

  return (
    <div className="space-y-1.5">
      <Label>Payment Terms</Label>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Payment terms">
        {TERM_OPTIONS.map((option) => {
          const active = option.value === value;
          return (
            <Button
              key={String(option.value)}
              type="button"
              size="sm"
              variant={active ? 'default' : 'outline'}
              aria-pressed={active}
              className="h-auto flex-col items-start gap-0 px-3 py-1.5"
              onClick={() => onChange(option.value)}
              disabled={disabled}
            >
              <span className="text-sm font-medium">{option.label}</span>
              <span className={active ? 'text-[11px] opacity-80' : 'text-[11px] text-mist'}>
                {option.hint}
              </span>
            </Button>
          );
        })}
      </div>
      <p className="text-xs text-mist">
        {value === null
          ? 'Due immediately on receipt of goods.'
          : dueDay
            ? `Due ${formatPoDate(dueDay)} (${value} days after the order date).`
            : `Due ${value} days after the order date.`}
      </p>
    </div>
  );
}
