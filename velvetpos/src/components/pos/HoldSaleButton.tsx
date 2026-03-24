'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useCartStore } from '@/stores/cartStore';

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
        `Sale held — Reference ${json.data.shortId}. Tap Retrieve to continue it.`,
        { duration: 8000 },
      );
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleHold}
      className="w-full py-2 rounded-lg border border-sand bg-transparent text-espresso font-body text-sm hover:bg-sand/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {loading ? 'Holding…' : 'Hold Sale'}
    </button>
  );
}
