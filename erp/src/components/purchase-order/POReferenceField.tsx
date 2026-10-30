'use client';

import { Wand2 } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Purchase-order reference.
 *
 * The server generates `PO-YYYYMM-####` when the field is left blank. The
 * placeholder shows the next free number for the selected month so an operator
 * who wants their own reference knows what would have been issued.
 */
interface POReferenceFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Next auto value, e.g. `PO-202610-0009`. Falls back to the pattern. */
  suggestedReference?: string | null;
  error?: string | undefined;
  disabled?: boolean | undefined;
}

export function POReferenceField({
  value,
  onChange,
  suggestedReference,
  error,
  disabled,
}: POReferenceFieldProps) {
  const isCustom = value.trim().length > 0;
  const nextAuto = suggestedReference ?? 'PO-YYYYMM-####';

  return (
    <div className="space-y-1.5">
      <Label htmlFor="po-reference">Reference No.</Label>
      <Input
        id="po-reference"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={nextAuto}
        maxLength={40}
        autoComplete="off"
        spellCheck={false}
        className="font-mono"
        disabled={disabled}
        aria-describedby="po-reference-hint"
      />
      <p id="po-reference-hint" className="flex items-center gap-1 text-xs text-mist">
        <Wand2 className="h-3 w-3" />
        {isCustom
          ? 'Your own reference — must be unique in this store.'
          : `Auto-generated on save (${nextAuto}). Leave blank to let the server number it.`}
      </p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
