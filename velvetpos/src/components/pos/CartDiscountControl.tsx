'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import type { UserRole } from '@/generated/prisma/client';
import { useCartStore, getCartSubtotal } from '@/stores/cartStore';
import { POS_DISCOUNT_THRESHOLDS } from '@/config/pos.config';
import { formatRupee } from '@/lib/format';
import { CartManagerPINModal } from '@/components/pos/CartManagerPINModal';

const PRIVILEGED_ROLES: UserRole[] = ['MANAGER', 'OWNER', 'SUPER_ADMIN'];

export function CartDiscountControl() {
  const { data: session } = useSession();
  const items = useCartStore((s) => s.items);
  const setCartDiscount = useCartStore((s) => s.setCartDiscount);
  const setAuthorizingManager = useCartStore((s) => s.setAuthorizingManager);
  const cartDiscountPercent = useCartStore((s) => s.cartDiscountPercent);
  const cartDiscountAmount = useCartStore((s) => s.cartDiscountAmount);

  const [mode, setMode] = useState<'percent' | 'fixed'>('percent');
  const [inputValue, setInputValue] = useState('');
  const [pinModalOpen, setPinModalOpen] = useState(false);

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

  const handleApply = () => {
    if (exceedsTotal || parsedInput <= 0) return;
    if (needsOverride) {
      setPinModalOpen(true);
      return;
    }
    setCartDiscount(mode, parsedInput);
    setInputValue('');
  };

  const handleClear = () => {
    setCartDiscount('percent', 0);
    setAuthorizingManager(null);
    setInputValue('');
  };

  const handlePinSuccess = (managerId: string) => {
    setCartDiscount(mode, parsedInput);
    setAuthorizingManager(managerId);
    setInputValue('');
  };

  return (
    <div className="px-4 py-2 border-t border-mist/30">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-body text-[13px] text-mist">Cart Discount</span>
        {hasActiveDiscount && (
          <button
            type="button"
            onClick={handleClear}
            className="font-body text-[11px] text-[#9B2226] hover:text-[#9B2226]/80 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Mode toggle */}
        <div className="flex shrink-0">
          <button
            type="button"
            onClick={() => { setMode('percent'); setInputValue(''); }}
            className={`px-2.5 py-1 text-xs font-body rounded-l-md transition-colors ${
              mode === 'percent'
                ? 'bg-sand text-espresso'
                : 'bg-transparent border border-mist text-mist'
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
                : 'bg-transparent border border-mist text-mist'
            }`}
          >
            Rs.
          </button>
        </div>

        {/* Input */}
        <input
          type="number"
          min="0"
          step="any"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={mode === 'percent' ? '0' : '0.00'}
          className={`max-w-[100px] px-2 py-1 text-sm font-body text-espresso bg-pearl border rounded-md outline-none transition-colors ${
            needsOverride ? 'border-[#B7791F]' : 'border-mist'
          }`}
        />

        {/* Apply / Override button */}
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
          {needsOverride ? 'Request Override' : 'Apply'}
        </button>
      </div>

      {/* Live preview */}
      {parsedInput > 0 && (
        <p className={`font-body text-xs mt-1 ${exceedsTotal ? 'text-[#9B2226]' : 'text-mist'}`}>
          {exceedsTotal
            ? 'Discount exceeds cart total'
            : `New total: ${formatRupee(Math.max(0, newTotal))}`}
        </p>
      )}

      <CartManagerPINModal
        open={pinModalOpen}
        onOpenChange={setPinModalOpen}
        description={`Authorise ${effectivePercent.toFixed(1)}% cart-level discount`}
        onSuccess={handlePinSuccess}
      />
    </div>
  );
}
