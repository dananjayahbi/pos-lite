'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Decimal from 'decimal.js';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatRupee } from '@/lib/format';
import { computeChange } from '@/lib/utils/payments';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PaymentModalProps, CompletedSale } from '@/types/pos.types';

const QUICK_AMOUNTS = [500, 1_000, 2_000, 5_000];

export function CashPaymentModal({
  open,
  onClose,
  onSaleComplete,
  totalAmount,
  salePayload,
}: PaymentModalProps) {
  const [cashReceived, setCashReceived] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setCashReceived('');
      setIsSubmitting(false);
    }
  }, [open]);

  // autoFocus fallback
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open]);

  // Parse cash received to Decimal
  const parsedCash = useMemo((): Decimal | null => {
    if (!cashReceived.trim()) return null;
    try {
      const d = new Decimal(cashReceived);
      return d.isNaN() ? null : d;
    } catch {
      return null;
    }
  }, [cashReceived]);

  // Compute change via payment service
  const changeResult = useMemo(() => {
    if (!parsedCash) return { type: 'empty' as const };
    try {
      const change = computeChange(totalAmount, parsedCash);
      return { type: 'sufficient' as const, change };
    } catch {
      return { type: 'insufficient' as const };
    }
  }, [parsedCash, totalAmount]);

  const canSubmit =
    parsedCash !== null &&
    changeResult.type === 'sufficient' &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit || !parsedCash) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/store/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...salePayload,
          paymentMethod: 'CASH',
          cashReceived: parsedCash.toNumber(),
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: CompletedSale;
        error?: { code: string; message: string };
      };
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? 'Failed to complete sale');
        setIsSubmitting(false);
        return;
      }
      onSaleComplete(json.data!);
    } catch {
      toast.error('Network error — please try again');
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isSubmitting) onClose();
      }}
    >
      <DialogContent
        className="sm:max-w-sm"
        showCloseButton={!isSubmitting}
        onEscapeKeyDown={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="font-display">Cash Payment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Total Due */}
          <div>
            <p className="text-xs font-body uppercase tracking-wide text-mist">
              Total Due
            </p>
            <p className="font-mono text-3xl font-bold text-espresso">
              {formatRupee(totalAmount.toNumber())}
            </p>
          </div>

          {/* Cash Received */}
          <div>
            <label className="mb-1 block text-sm font-body text-espresso">
              Cash Received
            </label>
            <div className="flex items-center gap-2">
              <span className="shrink-0 font-body text-sm text-mist">Rs.</span>
              <Input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                autoFocus
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                className="font-mono"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Quick-amount buttons */}
          <div className="flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map((amt) => (
              <Button
                key={amt}
                type="button"
                variant="outline"
                className={`border-sand text-sand font-mono text-sm${
                  new Decimal(amt).lessThan(totalAmount) ? ' opacity-50' : ''
                }`}
                onClick={() => setCashReceived(String(amt))}
              >
                Rs.&nbsp;{amt.toLocaleString('en-IN')}
              </Button>
            ))}
          </div>

          {/* Change display */}
          <div>
            <p className="mb-0.5 text-xs font-body uppercase tracking-wide text-mist">
              Change
            </p>
            {changeResult.type === 'empty' && (
              <p className="font-mono text-lg text-mist">—</p>
            )}
            {changeResult.type === 'sufficient' && (
              <p className="font-mono text-lg text-[#2D6A4F]">
                {formatRupee(changeResult.change.toNumber())}
              </p>
            )}
            {changeResult.type === 'insufficient' && (
              <p className="font-mono text-lg text-[#9B2226]">
                Insufficient — customer owes more
              </p>
            )}
          </div>

          {/* Submit */}
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="h-auto w-full py-3 bg-espresso text-pearl font-body text-base font-bold hover:bg-espresso/90"
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              `Complete Sale — ${formatRupee(totalAmount.toNumber())}`
            )}
          </Button>

          {/* Cancel */}
          {!isSubmitting && (
            <button
              type="button"
              onClick={onClose}
              className="w-full text-center font-body text-sm text-mist hover:text-espresso transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
