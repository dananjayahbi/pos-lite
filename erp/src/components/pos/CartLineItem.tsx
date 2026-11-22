'use client';

import { Minus, Plus, X, Sparkles } from 'lucide-react';
import { formatRupee } from '@/lib/format';
import { useCartStore, getLineTotalAfterDiscount } from '@/stores/cartStore';
import { focusPOSBarcodeInput } from '@/lib/pos/keyboard';
import type { CartItem } from '@/stores/cartStore';

interface CartLineItemProps {
  item: CartItem;
}

/** Moves focus to the previous/next cart row for keyboard-only review. */
function focusAdjacentCartLine(from: HTMLElement, direction: 1 | -1) {
  const lines = Array.from(document.querySelectorAll<HTMLElement>('[data-cart-line]'));
  const index = lines.indexOf(from);
  if (index === -1) return;
  const next = lines[index + direction];
  next?.focus();
}

export function CartLineItem({ item }: CartLineItemProps) {
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const setActiveLine = useCartStore((s) => s.setActiveLine);
  const setLineDiscount = useCartStore((s) => s.setLineDiscount);
  const activeLineId = useCartStore((s) => s.activeLineId);
  const appliedPromotions = useCartStore((s) => s.appliedPromotions);
  const isActive = activeLineId === item.variantId;

  const lineTotal = getLineTotalAfterDiscount(item);
  const linePromos = appliedPromotions.filter((p) => p.affectedLines.includes(item.variantId));

  return (
    <div
      role="button"
      data-cart-line=""
      tabIndex={0}
      aria-label={`${item.productName}, ${item.variantDescription}, quantity ${item.quantity}, ${formatRupee(lineTotal.toNumber())}`}
      aria-pressed={isActive}
      onClick={() => setActiveLine(item.variantId)}
      onKeyDown={(e) => {
        // Child buttons keep their native Enter/Space behaviour; the row
        // shortcuts only apply when the row itself has focus.
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setActiveLine(item.variantId);
          return;
        }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          focusAdjacentCartLine(e.currentTarget, e.key === 'ArrowDown' ? 1 : -1);
          return;
        }
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          updateQuantity(item.variantId, item.quantity + 1);
          return;
        }
        if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          updateQuantity(item.variantId, Math.max(1, item.quantity - 1));
          return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          removeItem(item.variantId);
          focusPOSBarcodeInput();
          return;
        }
        if (e.key === 'Escape') {
          setActiveLine(null);
        }
      }}
      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-terracotta ${
        isActive ? 'bg-linen' : 'hover:bg-linen/50'
      }`}
    >
      {/* Product info */}
      <div className="flex-1 min-w-0">
        <p className="font-body text-sm text-espresso truncate">{item.productName}</p>
        <p className="font-body text-xs text-mist-ink truncate">{item.variantDescription}</p>
        {item.discountPercent > 0 && (
          <span className="inline-flex items-center gap-1 font-body text-xs text-[#2D6A4F]">
            -{item.discountPercent}%
            <button
              type="button"
              onClick={(e) => {
                // Stop the row click so the line editor does not open on removal.
                e.stopPropagation();
                setLineDiscount(item.variantId, 0);
              }}
              className="inline-flex h-6 w-6 items-center justify-center text-[#9B2226]/70 hover:text-[#9B2226] transition-colors"
              aria-label={`Remove discount from ${item.productName}`}
              title="Remove line discount"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        )}
        {linePromos.map((p) => (
          <span key={p.promotionId} className="flex items-center gap-0.5 font-body text-xs text-green-700">
            <Sparkles className="h-3 w-3" />
            {p.label}
          </span>
        ))}
        <p className="font-mono text-[11px] text-mist-ink/70">{item.sku}</p>
      </div>

      {/* Quantity stepper */}
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
          disabled={item.quantity <= 1}
          className="inline-flex h-10 w-10 items-center justify-center text-terracotta hover:text-espresso disabled:opacity-40 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
          aria-label={`Decrease quantity of ${item.productName}`}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="font-mono text-sm text-espresso w-6 text-center" aria-live="polite">{item.quantity}</span>
        <button
          type="button"
          onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
          disabled={
            Number.isFinite(item.stockQuantity) && item.quantity >= (item.stockQuantity as number)
          }
          title={
            Number.isFinite(item.stockQuantity) && item.quantity >= (item.stockQuantity as number)
              ? `Only ${item.stockQuantity} in stock`
              : undefined
          }
          className="inline-flex h-10 w-10 items-center justify-center text-terracotta hover:text-espresso disabled:opacity-40 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
          aria-label={`Increase quantity of ${item.productName}`}
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
        onClick={(e) => {
          e.stopPropagation();
          removeItem(item.variantId);
          focusPOSBarcodeInput();
        }}
        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-mist-ink hover:text-[#9B2226] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
        aria-label={`Remove ${item.productName} from cart`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
