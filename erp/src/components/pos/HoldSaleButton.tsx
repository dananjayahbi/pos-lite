'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useCartStore } from '@/stores/cartStore';
import { usePOSShortcuts } from '@/hooks/usePOSShortcuts';
import { isPOSDialogOpen } from '@/lib/pos/keyboard';

interface HoldSaleButtonProps {
  shiftId: string;
}

export function HoldSaleButton({ shiftId }: HoldSaleButtonProps) {
  const items = useCartStore((s) => s.items);
  const cartDiscountPercent = useCartStore((s) => s.cartDiscountPercent);
  const cartDiscountAmount = useCartStore((s) => s.cartDiscountAmount);
  const authorizingManagerId = useCartStore((s) => s.authorizingManagerId);
  const clearCart = useCartStore((s) => s.clearCart);
  const heldSaleId = useCartStore((s) => s.heldSaleId);
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const disabled = items.length === 0 || loading;

  async function handleHold() {
    if (authorizingManagerId) {
      toast.warning(
        'Manager authorisation will not persist with the held sale. Re-authorise after retrieving.',
      );
    }

    setLoading(true);
    try {
      const res = await fetch('/api/store/sales/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId,
          lines: items.map((i) => ({
            variantId: i.variantId,
            quantity: Number(i.quantity),
            discountPercent: Number(i.discountPercent),
            productNameSnapshot: i.productName,
            variantDescriptionSnapshot: i.variantDescription || 'Default',
            sku: i.sku || 'UNKNOWN',
            unitPrice: Number(i.unitPrice),
          })),
          cartDiscountAmount: Number(cartDiscountAmount),
          cartDiscountPercent: Number(cartDiscountPercent),
          ...(heldSaleId ? { saleId: heldSaleId } : {}),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error?.message ?? 'Failed to hold sale');
        return;
      }

      clearCart();
      queryClient.invalidateQueries({ queryKey: ['held-sales-count'] });
      queryClient.invalidateQueries({ queryKey: ['held-sales'] });
      toast.success(
        `Sale held - Reference ${json.data.shortId}. Tap Retrieve to continue it.`,
        { duration: 8000 },
      );
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  usePOSShortcuts([
    {
      key: 'F8',
      allowInEditable: true,
      handler: () => {
        if (disabled || isPOSDialogOpen()) return;
        void handleHold();
      },
    },
  ]);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleHold}
      aria-keyshortcuts="F8"
      title="Hold this sale (F8)"
      className="min-h-11 w-full rounded-lg border border-sand bg-transparent py-2 font-body text-sm text-espresso transition-colors hover:bg-sand/20 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {loading ? 'Holding…' : 'Hold Sale'}
    </button>
  );
}
