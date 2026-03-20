'use client';

import { Minus, Plus, X } from 'lucide-react';
import { formatRupee } from '@/lib/format';
import { useCartStore, getLineTotalAfterDiscount } from '@/stores/cartStore';
import type { CartItem } from '@/stores/cartStore';

interface CartLineItemProps {
  item: CartItem;
}

export function CartLineItem({ item }: CartLineItemProps) {
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const setActiveLine = useCartStore((s) => s.setActiveLine);
  const activeLineId = useCartStore((s) => s.activeLineId);
  const isActive = activeLineId === item.variantId;

  const lineTotal = getLineTotalAfterDiscount(item);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setActiveLine(item.variantId)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveLine(item.variantId); }}
      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${isActive ? 'bg-linen' : 'hover:bg-linen/50'}`}
    >
      {/* Product info */}
      <div className="flex-1 min-w-0">
        <p className="font-body text-sm text-espresso truncate">{item.productName}</p>
        <p className="font-body text-xs text-mist truncate">{item.variantDescription}</p>
        {item.discountPercent > 0 && (
          <span className="font-body text-xs text-[#2D6A4F]">-{item.discountPercent}%</span>
        )}
        <p className="font-mono text-[11px] text-mist/70">{item.sku}</p>
      </div>

      {/* Quantity stepper */}
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
          disabled={item.quantity <= 1}
          className="p-1 text-terracotta hover:text-espresso disabled:opacity-40"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="font-mono text-sm text-espresso w-6 text-center">{item.quantity}</span>
        <button
          type="button"
          onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
          className="p-1 text-terracotta hover:text-espresso"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Line total */}
      <span className="font-mono text-sm font-bold text-espresso min-w-[80px] text-right">
        {formatRupee(lineTotal.toNumber())}
      </span>

      {/* Remove button */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); removeItem(item.variantId); }}
        className="p-1 text-mist hover:text-[#9B2226] transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
