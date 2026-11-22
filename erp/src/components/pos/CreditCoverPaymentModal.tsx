'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Decimal from 'decimal.js';
import { formatRupee } from '@/lib/format';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { CreateSalePayload, CompletedSale } from '@/types/pos.types';

type CreditMethod = 'STORE_CREDIT' | 'EXCHANGE_CREDIT';

interface CreditCoverPaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSaleComplete: (sale: CompletedSale) => void;
  /** Tender recorded on the sale. */
  method: CreditMethod;
  /** Label for the credit row, e.g. "Store credit applied". */
  creditLabel: string;
  /** Sale value before the credit is applied. */
  saleTotal: Decimal;
  /** Credit applied to this sale. */
  creditAmount: Decimal;
  salePayload: CreateSalePayload;
}

/**
 * Confirmation for a sale fully settled by credit (store credit or an EXCHANGE
 * return).
 *
 * Credit is a real tender: the sale keeps its full total and the API records a
 * credit payment leg instead of collecting cash/card. A fully covered sale is
 * therefore completed here, not through the zero-value flow (which is reserved
 * for genuinely free or replacement sales).
 */
export function CreditCoverPaymentModal({
  open,
  onClose,
  onSaleComplete,
  method,
  creditLabel,
  saleTotal,
  creditAmount,
  salePayload,
}: CreditCoverPaymentModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const title = method === 'EXCHANGE_CREDIT' ? 'Exchange Credit' : 'Store Credit Payment';

  const handleClose = () => {
    if (isSubmitting && !window.confirm('Are you sure? The sale may still be processing.')) {
      return;
    }
    setIsSubmitting(false);
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
          paymentMethod: method,
          ...(method === 'STORE_CREDIT' && {
            appliedStoreCredit: creditAmount.toFixed(2),
          }),
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
      toast.error('Network error - please try again');
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
          <DialogTitle className="font-display">{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="font-body text-espresso flex justify-between text-sm">
              <span>Sale total</span>
              <span className="font-mono">{formatRupee(saleTotal.toNumber())}</span>
            </div>
            <div className="font-body flex justify-between text-sm text-green-700">
              <span>{creditLabel}</span>
              <span className="font-mono">-{formatRupee(creditAmount.toNumber())}</span>
            </div>
            <div className="border-mist/30 font-body text-espresso flex justify-between border-t pt-1.5 text-sm font-semibold">
              <span>Amount to collect</span>
              <span className="font-mono">Rs 0.00</span>
            </div>
          </div>

          <div className="bg-linen rounded-lg border-l-4 border-[#2D6A4F] p-3">
            <p className="font-body text-espresso text-sm">
              {method === 'EXCHANGE_CREDIT'
                ? 'The linked return covers this sale in full. The replacement sale will be linked to the return.'
                : 'The customer\u2019s store credit covers this sale in full. The amount will be deducted from their balance when you confirm.'}
            </p>
          </div>

          <Button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="bg-espresso text-pearl font-body hover:bg-espresso/90 h-auto w-full py-3 text-base font-bold"
          >
            {isSubmitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : method === 'EXCHANGE_CREDIT' ? (
              'Complete Exchange Sale'
            ) : (
              'Complete Sale with Store Credit'
            )}
          </Button>

          <button
            type="button"
            onClick={handleClose}
            className="font-body text-mist-ink hover:text-espresso w-full text-center text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
