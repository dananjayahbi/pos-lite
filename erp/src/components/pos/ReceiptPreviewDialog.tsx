'use client';

import { useCallback } from 'react';
import { CheckCircle2, Printer, Plus } from 'lucide-react';
import Decimal from 'decimal.js';
import { formatRupee } from '@/lib/format';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { CompletedSale } from '@/types/pos.types';

interface ReceiptPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  onNewSale: () => void;
  completedSale: CompletedSale | null;
  changeAmount: Decimal | null;
}

export function ReceiptPreviewDialog({
  open,
  onClose,
  onNewSale,
  completedSale,
  changeAmount,
}: ReceiptPreviewDialogProps) {
  const handlePrint = useCallback(() => {
    if (!completedSale) return;
    window.open(`/api/store/sales/${completedSale.id}/receipt`, '_blank', 'noopener');
  }, [completedSale]);

  if (!completedSale) return null;

  const showChange =
    changeAmount !== null &&
    (completedSale.paymentMethod === 'CASH' || completedSale.paymentMethod === 'SPLIT');

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        // Suppress escape / backdrop close
        if (!isOpen) return;
      }}
    >
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="sr-only">Sale Complete</DialogTitle>
        </DialogHeader>

        {/* Success header */}
        <div className="flex flex-col items-center gap-2 pt-2 pb-4">
          <CheckCircle2 className="h-12 w-12" style={{ color: '#2D6A4F' }} />
          <h2 className="font-display text-2xl text-espresso">Sale Complete!</h2>
        </div>

        {/* Summary block */}
        <div className="bg-linen rounded-lg border-2 border-sand p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="font-body text-sm text-mist">Sale Ref</span>
            <span className="font-mono text-sm text-espresso">
              {completedSale.id.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-body text-sm text-mist">Total</span>
            <span className="font-mono text-xl font-bold text-espresso">
              {formatRupee(completedSale.totalAmount)}
            </span>
          </div>
          {showChange && (
            <div className="flex justify-between items-center">
              <span className="font-body text-sm text-mist">Change Due</span>
              <span
                className={`font-mono text-xl font-bold ${
                  changeAmount.isZero() ? 'text-espresso' : 'text-[#2D6A4F]'
                }`}
              >
                {formatRupee(changeAmount.toNumber())}
              </span>
            </div>
          )}
        </div>

        {/* Print Receipt */}
        <Button
          variant="outline"
          className="w-full mt-2"
          onClick={handlePrint}
        >
          <Printer className="h-4 w-4 mr-2" />
          Print Receipt
        </Button>

        {/* No receipt link */}
        <button
          type="button"
          onClick={onClose}
          className="w-full text-center font-body text-sm text-mist hover:text-espresso transition-colors py-1"
        >
          No Receipt — close
        </button>

        {/* New Sale button */}
        <Button
          className="w-full bg-espresso text-pearl hover:bg-espresso/90"
          onClick={onNewSale}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Sale
        </Button>
      </DialogContent>
    </Dialog>
  );
}
