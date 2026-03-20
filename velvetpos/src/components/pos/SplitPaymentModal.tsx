'use client';

import { useState, useEffect, useMemo } from 'react';
import Decimal from 'decimal.js';
import { Loader2, CheckCircle2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { formatRupee } from '@/lib/format';
import { computeChange } from '@/lib/services/payment.service';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PaymentModalProps, CompletedSale } from '@/types/pos.types';

export function SplitPaymentModal({
  open,
  onClose,
  onSaleComplete,
  totalAmount,
  salePayload,
}: PaymentModalProps) {
  const [cardAmountStr, setCardAmountStr] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [cardReferenceNumber, setCardReferenceNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset all state when dialog closes
  useEffect(() => {
    if (!open) {
      setCardAmountStr('');
      setCashReceived('');
      setCardReferenceNumber('');
      setIsSubmitting(false);
    }
  }, [open]);

  // ── Derived values ────────────────────────────────────────────────────

  const parsedCardAmount = useMemo((): Decimal | null => {
    if (!cardAmountStr.trim()) return null;
    try {
      const d = new Decimal(cardAmountStr);
      return d.isNaN() || d.isNegative() ? null : d;
    } catch {
      return null;
    }
  }, [cardAmountStr]);

  const cashAmount = useMemo((): Decimal | null => {
    if (!parsedCardAmount) return null;
    return totalAmount.minus(parsedCardAmount);
  }, [parsedCardAmount, totalAmount]);

  const parsedCashReceived = useMemo((): Decimal | null => {
    if (!cashReceived.trim()) return null;
    try {
      const d = new Decimal(cashReceived);
      return d.isNaN() ? null : d;
    } catch {
      return null;
    }
  }, [cashReceived]);

  const cardExceedsTotal =
    parsedCardAmount !== null && parsedCardAmount.greaterThan(totalAmount);

  const showCashReceivedInput =
    parsedCardAmount !== null &&
    cashAmount !== null &&
    cashAmount.greaterThan(0) &&
    !cardExceedsTotal;

  const allocationMatches =
    parsedCardAmount !== null &&
    cashAmount !== null &&
    parsedCardAmount.gt(0) &&
    cashAmount.gt(0) &&
    parsedCardAmount.plus(cashAmount).eq(totalAmount);

  // Change = cashReceived - cashAmount (not totalAmount)
  const changeResult = useMemo(() => {
    if (!cashAmount || !parsedCashReceived || cashAmount.lte(0)) {
      return { type: 'empty' as const };
    }
    try {
      const change = computeChange(cashAmount, parsedCashReceived);
      return { type: 'sufficient' as const, change };
    } catch {
      return { type: 'insufficient' as const };
    }
  }, [cashAmount, parsedCashReceived]);

  // ── Validation ────────────────────────────────────────────────────────

  const validationError = useMemo((): string | null => {
    if (!cardAmountStr.trim()) return null;
    if (!parsedCardAmount || parsedCardAmount.lte(0)) {
      return 'Card amount must be greater than zero';
    }
    if (!cashAmount || cashAmount.lte(0)) {
      return 'Cash amount must be greater than zero';
    }
    if (!parsedCardAmount.plus(cashAmount).eq(totalAmount)) {
      return 'Card and cash amounts must equal the total';
    }
    if (cashReceived.trim()) {
      if (!parsedCashReceived || parsedCashReceived.lessThan(cashAmount)) {
        return 'Cash received must be at least the cash amount due';
      }
    }
    return null;
  }, [
    cardAmountStr,
    parsedCardAmount,
    cashAmount,
    totalAmount,
    cashReceived,
    parsedCashReceived,
  ]);

  const canSubmit =
    !isSubmitting &&
    parsedCardAmount !== null &&
    parsedCardAmount.gt(0) &&
    cashAmount !== null &&
    cashAmount.gt(0) &&
    parsedCardAmount.plus(cashAmount).eq(totalAmount) &&
    parsedCashReceived !== null &&
    !parsedCashReceived.lessThan(cashAmount);

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!canSubmit || !parsedCardAmount || !parsedCashReceived) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/store/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...salePayload,
          paymentMethod: 'SPLIT',
          cardAmount: parsedCardAmount.toNumber(),
          cardReferenceNumber,
          cashReceived: parsedCashReceived.toNumber(),
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
        className="sm:max-w-md"
        showCloseButton={!isSubmitting}
        onEscapeKeyDown={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="font-display">Split Payment</DialogTitle>
          <DialogDescription className="font-body text-sm text-mist">
            Part card, part cash — both amounts must add up to the total.
          </DialogDescription>
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

          {/* Card Amount */}
          <div>
            <label className="mb-1 block text-sm font-body text-espresso">
              Amount to charge to card
            </label>
            <div className="flex items-center gap-2">
              <span className="shrink-0 font-body text-sm text-mist">Rs.</span>
              <Input
                type="text"
                inputMode="decimal"
                value={cardAmountStr}
                onChange={(e) => setCardAmountStr(e.target.value)}
                className="font-mono"
                placeholder="0.00"
              />
            </div>
            {cardExceedsTotal && (
              <p className="mt-1 text-xs font-body text-[#9B2226]">
                Card amount cannot exceed the total
              </p>
            )}
          </div>

          {/* Cash Amount (read-only) */}
          <div>
            <label className="mb-1 block text-sm font-body text-espresso">
              Cash amount due
            </label>
            <div className="rounded-lg border border-sand/30 bg-sand/20 px-3 py-2">
              {cashAmount === null ? (
                <span className="font-mono text-lg text-mist">—</span>
              ) : cashAmount.eq(0) ? (
                <div>
                  <span className="font-mono text-lg text-espresso">
                    Rs. 0.00
                  </span>
                  <p className="mt-0.5 text-xs font-body text-mist">
                    Entire amount on card — no cash needed
                  </p>
                </div>
              ) : cashAmount.lessThan(0) ? (
                <span className="font-mono text-lg text-[#9B2226]">
                  {formatRupee(cashAmount.toNumber())}
                </span>
              ) : (
                <span className="font-mono text-lg text-espresso">
                  {formatRupee(cashAmount.toNumber())}
                </span>
              )}
            </div>
          </div>

          {/* Allocation summary */}
          {parsedCardAmount !== null && cashAmount !== null && (
            <div
              className={`flex items-center gap-1.5 font-mono text-sm ${
                allocationMatches ? 'text-[#2D6A4F]' : 'text-mist'
              }`}
            >
              {allocationMatches && (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              )}
              <span>
                Card: {formatRupee(parsedCardAmount.toNumber())} + Cash:{' '}
                {formatRupee(cashAmount.toNumber())} ={' '}
                {formatRupee(
                  parsedCardAmount.plus(cashAmount).toNumber(),
                )}
              </span>
            </div>
          )}

          {/* Cash Received (only when split requires cash) */}
          {showCashReceivedInput && (
            <div>
              <label className="mb-1 block text-sm font-body text-espresso">
                Cash Received
              </label>
              <div className="flex items-center gap-2">
                <span className="shrink-0 font-body text-sm text-mist">
                  Rs.
                </span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  className="font-mono"
                  placeholder="0.00"
                />
              </div>
              {/* Change display */}
              <div className="mt-1.5">
                <p className="mb-0.5 text-xs font-body uppercase tracking-wide text-mist">
                  Change
                </p>
                {changeResult.type === 'empty' && (
                  <p className="font-mono text-base text-mist">—</p>
                )}
                {changeResult.type === 'sufficient' && (
                  <p className="font-mono text-base text-[#2D6A4F]">
                    {formatRupee(changeResult.change.toNumber())}
                  </p>
                )}
                {changeResult.type === 'insufficient' && (
                  <p className="font-mono text-base text-[#9B2226]">
                    Insufficient cash received
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Card Approval Code */}
          <div>
            <div className="mb-1 flex items-center gap-1">
              <label className="text-sm font-body text-espresso">
                Approval Code
              </label>
              <span title="Used for reconciliation with your card terminal">
                <Info className="h-3.5 w-3.5 text-mist cursor-help" />
              </span>
            </div>
            <Input
              type="text"
              value={cardReferenceNumber}
              onChange={(e) => setCardReferenceNumber(e.target.value)}
              placeholder="e.g. 481200"
              maxLength={20}
              className="font-mono"
            />
          </div>

          {/* Validation error */}
          {validationError !== null && (
            <p className="text-sm font-body text-[#9B2226]">
              {validationError}
            </p>
          )}

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
              `Complete Split Payment — ${formatRupee(totalAmount.toNumber())}`
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
