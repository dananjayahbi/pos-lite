'use client';

import { useState } from 'react';
import { Loader2, ScanLine } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/**
 * M14-04 (req 3.11 / client decision D14) — scanner-safe defective-item
 * barcode capture for the POS zero-value "Product Replacement" dialog.
 *
 * The cashier scans (or types) the barcode of the physical defective unit
 * being replaced. Barcode-wedge scanners terminate with Enter, so Enter is
 * intercepted and used to run the same tenant lookup the dialog already uses
 * for the original-order reference (`/api/store/variants/barcode/[barcode]`,
 * which returns 404 BARCODE_NOT_FOUND on a miss). `e.preventDefault()` keeps
 * the Enter from submitting the surrounding form — the same pattern
 * `StockAdjustmentForm`'s search field uses for wedge input.
 *
 * Validation is advisory here: the sale POST is the authority (the service
 * re-resolves the barcode transactionally and 400s on a miss), so the dialog
 * can be confirmed even if this live check was skipped — but a confirmed scan
 * gives the cashier the audit-quality signal the client asked for.
 */
type ScanState = 'idle' | 'loading' | 'valid' | 'invalid';

interface DefectiveBarcodeFieldProps {
  value: string;
  onChange: (next: string) => void;
  /** Called whenever the resolution state changes so the parent can surface it. */
  onStateChange?: (state: ScanState, message?: string) => void;
  disabled?: boolean;
}

export function DefectiveBarcodeField({
  value,
  onChange,
  onStateChange,
  disabled,
}: DefectiveBarcodeFieldProps) {
  const [state, setState] = useState<ScanState>('idle');
  const [message, setMessage] = useState<string>('');

  const report = (next: ScanState, msg?: string) => {
    setState(next);
    setMessage(msg ?? '');
    onStateChange?.(next, msg);
  };

  const resolve = async () => {
    const barcode = value.trim();
    if (!barcode) {
      report('invalid', 'Scan or enter the defective item barcode');
      return;
    }
    report('loading');
    try {
      const res = await fetch(
        `/api/store/variants/barcode/${encodeURIComponent(barcode)}`,
      );
      const json = (await res.json().catch(() => null)) as {
        success?: boolean;
        data?: { productName?: string; sku?: string };
        error?: { message?: string };
      } | null;
      if (res.ok && json?.success) {
        report(
          'valid',
          `Matched: ${json.data?.productName ?? 'product'} (${json.data?.sku ?? barcode})`,
        );
      } else {
        report('invalid', json?.error?.message ?? 'Barcode not found in this store');
      }
    } catch {
      report('invalid', 'Network error — please try again');
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-body text-espresso" htmlFor="defective-barcode">
        Defective Item Barcode
      </label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mist" />
          <Input
            id="defective-barcode"
            type="text"
            inputMode="none"
            autoComplete="off"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              report('idle');
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              // Keyboard-wedge scanners end with Enter: resolve the scan and
              // never submit the dialog form from this field.
              e.preventDefault();
              void resolve();
            }}
            placeholder="Scan or type barcode, then Enter"
            className="pl-9 font-mono"
            disabled={disabled}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!value.trim() || state === 'loading' || disabled}
          onClick={() => void resolve()}
        >
          {state === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
        </Button>
      </div>
      {state === 'valid' && message && (
        <p className="font-body text-xs text-[#2D6A4F]">{message}</p>
      )}
      {state === 'invalid' && message && (
        <p className="font-body text-xs text-[#9B2226]">{message}</p>
      )}
    </div>
  );
}
