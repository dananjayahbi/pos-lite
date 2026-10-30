'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { formatPoDate, todayIso } from './poDates';

/** The PO document date — editable so a manager can backdate an order. */
interface POOrderDateFieldProps {
  /** Local `yyyy-mm-dd` (what the date input holds). */
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  disabled?: boolean | undefined;
}

export function POOrderDateField({
  value,
  onChange,
  error,
  disabled,
}: POOrderDateFieldProps) {
  const isToday = value === todayIso();

  return (
    <div className="space-y-1.5">
      <Label htmlFor="po-order-date">Purchase Order Date</Label>
      <Input
        id="po-order-date"
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-describedby="po-order-date-hint"
      />
      <p id="po-order-date-hint" className="text-xs text-mist">
        {value
          ? `${formatPoDate(value)}${isToday ? ' · today' : ' · backdated'}`
          : 'Defaults to today.'}
      </p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
