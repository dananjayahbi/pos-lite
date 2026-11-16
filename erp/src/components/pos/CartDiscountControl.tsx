'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { ChevronDown, Percent, Tag } from 'lucide-react';
import type { UserRole } from '@/generated/prisma/client';
import { useCartStore, getCartSubtotal } from '@/stores/cartStore';
import { POS_DISCOUNT_THRESHOLDS } from '@/config/pos.config';
import { formatRupee } from '@/lib/format';
import { usePOSShortcuts } from '@/hooks/usePOSShortcuts';
import { focusPOSBarcodeInput, isPOSDialogOpen } from '@/lib/pos/keyboard';

const PRIVILEGED_ROLES: UserRole[] = ['MANAGER', 'OWNER', 'SUPER_ADMIN'];

interface CartDiscountControlProps {
  /** Panel state is owned by CartPanel so `Alt+P` can expand it too. */
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  /** Applied promo code — surfaced in the header while the panel is collapsed. */
  activePromoCode?: string | null | undefined;
  /** Promo-code controls rendered inside the same collapsible panel. */
  children?: ReactNode;
}

/**
 * Collapsible "Discounts & promo" section.
 *
 * Both the manual cart discount and the promo-code controls live here so a
 * single toggle (and a single `Alt+Shift+D`) reclaims the vertical space for
 * the line-item list. The applied promo code stays visible in the header while
 * collapsed, so hiding the section never hides that a promotion is active.
 */
export function CartDiscountControl({
  expanded,
  onExpandedChange,
  activePromoCode,
  children,
}: CartDiscountControlProps) {
  const { data: session } = useSession();
  const items = useCartStore((s) => s.items);
  const setCartDiscount = useCartStore((s) => s.setCartDiscount);
  const cartDiscountPercent = useCartStore((s) => s.cartDiscountPercent);
  const cartDiscountAmount = useCartStore((s) => s.cartDiscountAmount);

  const [mode, setMode] = useState<'percent' | 'fixed'>('percent');
  const [inputValue, setInputValue] = useState('');
  const [overrideBlocked, setOverrideBlocked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const role = session?.user?.role;
  const isPrivileged = role != null && PRIVILEGED_ROLES.includes(role);

  const subtotal = getCartSubtotal(items).toNumber();
  const parsedInput = parseFloat(inputValue) || 0;
  const hasActiveDiscount = cartDiscountPercent > 0 || cartDiscountAmount > 0;

  const effectivePercent =
    mode === 'percent'
      ? parsedInput
      : subtotal > 0
        ? (parsedInput / subtotal) * 100
        : 0;

  const discountAmount = (subtotal * effectivePercent) / 100;
  const newTotal = subtotal - discountAmount;
  const exceedsTotal = newTotal < 0;
  const needsOverride = !isPrivileged && effectivePercent > POS_DISCOUNT_THRESHOLDS.cartMaxPercent;
  // What is actually applied (the input preview is a separate, in-progress value).
  const appliedDiscountAmount =
    cartDiscountPercent > 0 ? (subtotal * cartDiscountPercent) / 100 : cartDiscountAmount;

  const setExpanded = (next: boolean) => {
    if (!next) {
      setInputValue('');
      setOverrideBlocked(false);
      focusPOSBarcodeInput();
    }
    onExpandedChange(next);
  };
  const toggleExpanded = () => setExpanded(!expanded);

  // The keyboard shortcut that toggles the section (works from the always-
  // focused barcode box, which is an editable target).
  usePOSShortcuts([
    {
      key: 'D',
      alt: true,
      shift: true,
      allowInEditable: true,
      handler: () => {
        if (isPOSDialogOpen()) return;
        toggleExpanded();
      },
    },
  ]);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  const handleApply = () => {
    if (exceedsTotal || parsedInput <= 0) return;
    if (needsOverride) {
      setOverrideBlocked(true);
      return;
    }
    setCartDiscount(mode, parsedInput);
    setInputValue('');
    setOverrideBlocked(false);
  };

  const handleClear = () => {
    setCartDiscount('percent', 0);
    setInputValue('');
    setOverrideBlocked(false);
  };

  return (
    <div className="px-4 py-2 border-t border-mist/30">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={toggleExpanded}
          aria-expanded={expanded}
          aria-controls="pos-discount-promo-panel"
          aria-keyshortcuts="Alt+Shift+D"
          title={
            hasActiveDiscount
              ? `Discounts & promo applied - ${formatRupee(Math.min(subtotal, appliedDiscountAmount))} (Alt+Shift+D)`
              : 'Discounts & promo (Alt+Shift+D)'
          }
          className="flex min-h-8 min-w-0 items-center gap-1 font-body text-[13px] text-mist-ink transition-colors hover:text-espresso focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
        >
          <Percent className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">Discounts &amp; promo</span>
          {hasActiveDiscount && (
            <span className="shrink-0 font-mono text-[11px] text-[#2D6A4F]">
              −{formatRupee(Math.min(subtotal, appliedDiscountAmount))}
            </span>
          )}
          {activePromoCode && (
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-linen px-1.5 py-0.5 font-mono text-[10px] text-espresso">
              <Tag className="h-2.5 w-2.5" aria-hidden="true" />
              {activePromoCode}
            </span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
        {expanded && hasActiveDiscount && (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 font-body text-[11px] text-[#9B2226] hover:text-[#9B2226]/80 transition-colors"
            aria-label="Remove cart discount"
          >
            Remove
          </button>
        )}
      </div>

      {!expanded && !hasActiveDiscount && !activePromoCode && (
        <p className="mt-0.5 font-body text-[11px] text-mist-ink/70">
          No discount or promo - <kbd className="font-mono">Alt+Shift+D</kbd> to add one.
        </p>
      )}

      {expanded && (
        <div id="pos-discount-promo-panel" className="mt-1.5 space-y-3">
          <div>
            {hasActiveDiscount && (
              <p className="mb-1.5 font-body text-[11px] text-[#2D6A4F]">
                Applied:{' '}
                {cartDiscountPercent > 0
                  ? `${cartDiscountPercent}% off`
                  : `${formatRupee(cartDiscountAmount)} off`}{' '}
                ({formatRupee(Math.min(subtotal, appliedDiscountAmount))})
              </p>
            )}

            <div className="flex items-center gap-2">
              {/* Mode toggle */}
              <div className="flex shrink-0">
                <button
                  type="button"
                  onClick={() => { setMode('percent'); setInputValue(''); }}
                  className={`px-2.5 py-1 text-xs font-body rounded-l-md transition-colors ${
                    mode === 'percent'
                      ? 'bg-sand text-espresso'
                      : 'bg-transparent border border-mist text-mist-ink'
                  }`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('fixed'); setInputValue(''); }}
                  className={`px-2.5 py-1 text-xs font-body rounded-r-md transition-colors ${
                    mode === 'fixed'
                      ? 'bg-sand text-espresso'
                      : 'bg-transparent border border-mist text-mist-ink'
                  }`}
                >
                  Rs.
                </button>
              </div>

              {/* Input */}
              <input
                ref={inputRef}
                id="pos-cart-discount-input"
                type="number"
                min="0"
                step="any"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleApply();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setExpanded(false);
                  }
                }}
                placeholder={mode === 'percent' ? '0' : '0.00'}
                aria-label={mode === 'percent' ? 'Cart discount percent' : 'Cart discount amount'}
                className={`max-w-[100px] px-2 py-1 text-sm font-body text-espresso bg-pearl border rounded-md outline-none transition-colors ${
                  needsOverride ? 'border-[#B7791F]' : 'border-mist'
                }`}
              />

              {/* Apply button */}
              <button
                type="button"
                onClick={handleApply}
                disabled={exceedsTotal || parsedInput <= 0}
                className={`px-3 py-1 text-xs font-body rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  needsOverride
                    ? 'text-[#B7791F] border border-[#B7791F] bg-transparent hover:bg-[#B7791F]/10'
                    : 'text-pearl bg-espresso hover:bg-espresso/90'
                }`}
              >
                Apply
              </button>
            </div>

            {/* Live preview */}
            {parsedInput > 0 && (
              <p className={`font-body text-xs mt-1 ${exceedsTotal ? 'text-[#9B2226]' : 'text-mist-ink'}`}>
                {exceedsTotal
                  ? 'Discount exceeds cart total'
                  : `New total: ${formatRupee(Math.max(0, newTotal))}`}
              </p>
            )}

            {overrideBlocked && needsOverride && (
              <p className="font-body text-xs mt-1 text-[#B7791F]">
                Discounts above {POS_DISCOUNT_THRESHOLDS.cartMaxPercent}% require a Manager or Owner to apply.
              </p>
            )}
          </div>

          {children && (
            <div className="border-t border-mist/40 pt-3" data-testid="promo-code-section">
              {children}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
