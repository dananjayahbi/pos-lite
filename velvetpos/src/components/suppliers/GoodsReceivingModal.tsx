'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GoodsReceivingForm, type PurchaseOrderDetail } from '@/components/suppliers/GoodsReceivingForm';

// ── Types ────────────────────────────────────────────────────────────────────

interface GoodsReceivingModalProps {
  po: PurchaseOrderDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (result: {
    costPricesChanged: Array<{
      variantId: string;
      oldCostPrice: string;
      newCostPrice: string;
    }>;
    costPriceChangedCount: number;
  }) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function GoodsReceivingModal({
  po,
  open,
  onOpenChange,
  onSuccess,
}: GoodsReceivingModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-espresso">
            Receive Goods
          </DialogTitle>
          <DialogDescription>
            Enter the quantities received for each line item.
          </DialogDescription>
        </DialogHeader>
        <GoodsReceivingForm
          po={po}
          onCancel={() => onOpenChange(false)}
          cancelLabel="Close"
          onSuccess={(result) => {
            onOpenChange(false);
            onSuccess(result);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
