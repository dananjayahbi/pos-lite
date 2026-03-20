'use client';

import { useState, useEffect } from 'react';
import { Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { formatRupee } from '@/lib/format';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PaymentModalProps, CompletedSale } from '@/types/pos.types';

export function CardPaymentModal({
  open,
  onClose,
  onSaleComplete,
  totalAmount,
  salePayload,
}: PaymentModalProps) {
  const [cardReferenceNumber, setCardReferenceNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setCardReferenceNumber('');
      setIsSubmitting(false);
    }
  }, [open]);

  const handleClose = () => {
    if (
      isSubmitting &&
      !window.confirm('Are you sure? The sale may still be processing.')
    ) {
      return;
    }
    onClose();
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/store/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...salePayload,
          paymentMethod: 'CARD',
          cardReferenceNumber,
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
        if (!nextOpen) handleClose();
      }}
    >
      <DialogContent
        className="sm:max-w-sm"
        onEscapeKeyDown={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (isSubmitting) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="font-display">Card Payment</DialogTitle>
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

          {/* Info banner */}
          <div className="rounded-lg border-l-4 border-[#1D4E89] bg-linen p-3">
            <p className="font-body text-sm text-espresso">
              Please process the payment on your card machine before confirming
              here. This system does not connect to the card terminal directly.
            </p>
          </div>

          {/* Terminal Reference */}
          <div>
            <div className="mb-1 flex items-center gap-1">
              <label className="text-sm font-body text-espresso">
                Terminal Reference / Approval Code
              </label>
              <span title="Used for reconciliation with your card terminal's transaction records">
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

          {/* Phase 5 integration slot */}
          {/* Future: PayHere / card terminal integration */}
          <div data-payhere-integration-slot="true" />

          {/* Submit */}
          <Button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="h-auto w-full py-3 bg-espresso text-pearl font-body text-base font-bold hover:bg-espresso/90"
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              `Card Payment Confirmed — ${formatRupee(totalAmount.toNumber())}`
            )}
          </Button>

          {/* Cancel */}
          <button
            type="button"
            onClick={handleClose}
            className="w-full text-center font-body text-sm text-mist hover:text-espresso transition-colors"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
