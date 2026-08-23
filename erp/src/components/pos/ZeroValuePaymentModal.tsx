'use client';

import { useState } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import type { PaymentModalProps, CompletedSale } from '@/types/pos.types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Reason keys surfaced to the cashier (doc 33). PRODUCT_REPLACEMENT additionally
// requires a validated original order reference (doc 34).
const REASON_OPTIONS = [
  {
    value: 'BANK_PAYMENT' as const,
    label: 'Bank Payment',
    hint: 'Advance already received via bank transfer',
  },
  {
    value: 'PRODUCT_REPLACEMENT' as const,
    label: 'Product Replacement',
    hint: 'Free replacement for a previous order',
  },
  {
    value: 'COMPLIMENTARY_GIFT' as const,
    label: 'Complimentary Gift',
    hint: 'Free issue approved by the business',
  },
];

type ReasonValue = (typeof REASON_OPTIONS)[number]['value'];

interface ValidateResult {
  status: 'idle' | 'loading' | 'valid' | 'invalid';
  message?: string;
}

export function ZeroValuePaymentModal({
  open,
  onClose,
  onSaleComplete,
  salePayload,
}: PaymentModalProps) {
  const [reason, setReason] = useState<ReasonValue | null>(null);
  const [linkedRef, setLinkedRef] = useState('');
  const [validateResult, setValidateResult] = useState<ValidateResult>({
    status: 'idle',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reset = () => {
    setReason(null);
    setLinkedRef('');
    setValidateResult({ status: 'idle' });
    setIsSubmitting(false);
  };

  const isReplacement = reason === 'PRODUCT_REPLACEMENT';
  const refValidated = validateResult.status === 'valid';
  const canConfirm =
    reason !== null &&
    (!isReplacement || (linkedRef.trim().length > 0 && refValidated)) &&
    !isSubmitting;

  const handleValidate = async () => {
    const ref = linkedRef.trim();
    if (!ref) {
      setValidateResult({ status: 'invalid', message: 'Enter an original order reference' });
      return;
    }
    setValidateResult({ status: 'loading' });
    try {
      const res = await fetch('/api/store/sales/validate-replacement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: ref }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { valid: boolean; message?: string; originalOrder?: { id: string; totalAmount: string } };
        error?: { message: string };
      };
      if (!res.ok || !json.success) {
        setValidateResult({ status: 'invalid', message: json.error?.message ?? 'Validation failed' });
        return;
      }
      if (json.data?.valid) {
        setValidateResult({
          status: 'valid',
          message: `Linked to order ${json.data.originalOrder?.id.slice(0, 8).toUpperCase()} (Rs. ${json.data.originalOrder?.totalAmount})`,
        });
      } else {
        setValidateResult({
          status: 'invalid',
          ...(json.data?.message ? { message: json.data.message } : {}),
        });
      }
    } catch {
      setValidateResult({ status: 'invalid', message: 'Network error — please try again' });
    }
  };

  const handleConfirm = async () => {
    if (!canConfirm || !reason) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/store/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...salePayload,
          paymentMethod: 'NONE',
          zeroValueReason: reason,
          ...(isReplacement ? { zeroValueLinkedOrderRef: linkedRef.trim() } : {}),
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: CompletedSale;
        error?: { code: string; message: string };
      };
      if (!res.ok || !json.success) {
        toast.error(json.error?.message ?? 'Failed to complete zero-value sale');
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
        if (!nextOpen) {
          if (!isSubmitting) onClose();
          else reset();
        }
      }}
    >
      <DialogContent
        className="sm:max-w-sm"
        showCloseButton={!isSubmitting}
        onInteractOutside={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <ShieldAlert className="h-4 w-4 text-terracotta" />
            Zero-Value Sale
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md bg-linen px-3 py-2">
            <p className="font-body text-xs text-mist">
              The cart total is <span className="font-mono font-semibold text-espresso">Rs. 0.00</span>.
              Select a reason to complete this sale without a payment.
            </p>
          </div>

          {/* Reason selection */}
          <div className="space-y-1.5">
            <p className="text-sm font-body text-espresso">Reason</p>
            {REASON_OPTIONS.map((opt) => {
              const active = reason === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setReason(opt.value);
                    setValidateResult({ status: 'idle' });
                  }}
                  className={`flex w-full items-start gap-2 rounded-md border px-3 py-2 text-left transition-colors ${
                    active
                      ? 'border-terracotta bg-linen'
                      : 'border-mist/50 hover:border-sand'
                  }`}
                >
                  <span
                    className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border ${
                      active ? 'border-terracotta bg-terracotta' : 'border-mist'
                    }`}
                  />
                  <span className="min-w-0">
                    <span className="block font-body text-sm text-espresso">
                      {opt.label}
                    </span>
                    <span className="block font-body text-xs text-mist">
                      {opt.hint}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Original order linkage (doc 34) */}
          {isReplacement && (
            <div className="space-y-2">
              <label className="block text-sm font-body text-espresso">
                Original Order ID
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={linkedRef}
                  onChange={(e) => {
                    setLinkedRef(e.target.value);
                    setValidateResult({ status: 'idle' });
                  }}
                  placeholder="Order reference / ID"
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!linkedRef.trim() || validateResult.status === 'loading'}
                  onClick={handleValidate}
                >
                  {validateResult.status === 'loading' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Validate'
                  )}
                </Button>
              </div>
              {validateResult.status === 'valid' && validateResult.message && (
                <p className="font-body text-xs text-[#2D6A4F]">
                  {validateResult.message}
                </p>
              )}
              {validateResult.status === 'invalid' && validateResult.message && (
                <p className="font-body text-xs text-[#9B2226]">
                  {validateResult.message}
                </p>
              )}
            </div>
          )}

          {/* Confirm */}
          <Button
            type="button"
            disabled={!canConfirm}
            onClick={handleConfirm}
            className="w-full"
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Complete Zero-Value Sale
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
