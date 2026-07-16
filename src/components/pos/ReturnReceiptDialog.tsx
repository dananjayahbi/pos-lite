'use client';

import { useCallback } from 'react';
import { CheckCircle2, Printer } from 'lucide-react';
import { formatRupee } from '@/lib/format';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ReturnReceiptDialogProps {
  returnId: string;
  refundAmount: number | string;
  refundMethod: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

const REFUND_METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash Refund',
  CARD_REVERSAL: 'Card Reversal',
  STORE_CREDIT: 'Store Credit',
  EXCHANGE: 'Exchange',
};

export function ReturnReceiptDialog({
  returnId,
  refundAmount,
  refundMethod,
  open,
  onOpenChange,
  onDone,
}: ReturnReceiptDialogProps) {
  const handlePrint = useCallback(() => {
    window.open(`/api/store/returns/${returnId}/receipt`, '_blank', 'noopener');
  }, [returnId]);

  // WhatsApp dispatch will be added when return receipt templates are configured
  // in Meta Business Manager. Requires separate template approval.

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) return;
        onOpenChange(isOpen);
      }}
    >
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="sr-only">Return Processed</DialogTitle>
        </DialogHeader>

        {/* Success header */}
        <div className="flex flex-col items-center gap-2 pt-2 pb-4">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="font-display text-2xl text-espresso">Return Processed</h2>
        </div>

        {/* Summary block */}
        <div className="bg-linen rounded-lg border-2 border-sand p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="font-body text-sm text-mist">Return Ref</span>
            <span className="font-mono text-sm text-espresso">
              {returnId.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-body text-sm text-mist">Refund Amount</span>
            <span className="font-mono text-xl font-bold text-espresso">
              {formatRupee(Number(refundAmount))}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-body text-sm text-mist">Method</span>
            <Badge variant="outline" className="font-body text-xs">
              {REFUND_METHOD_LABELS[refundMethod] ?? refundMethod}
            </Badge>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-2">
          <Button
            onClick={handlePrint}
            className="w-full bg-terracotta text-white hover:bg-terracotta/90"
          >
            <Printer className="h-4 w-4 mr-2" />
            Print Return Receipt
          </Button>
          <Button
            variant="outline"
            onClick={onDone}
            className="w-full"
          >
            Done
          </Button>
          <button
            type="button"
            onClick={onDone}
            className="text-xs font-body text-mist hover:text-espresso underline self-center"
          >
            Skip receipt
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
