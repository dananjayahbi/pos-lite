'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import type { UserRole } from '@/generated/prisma/client';
import { useCartStore, getLineTotalAfterDiscount } from '@/stores/cartStore';
import type { CartItem } from '@/stores/cartStore';
import { POS_DISCOUNT_THRESHOLDS } from '@/config/pos.config';
import { formatRupee } from '@/lib/format';
import { CartManagerPINModal } from '@/components/pos/CartManagerPINModal';

interface LineItemDiscountControlProps {
  item: CartItem;
}

const PRIVILEGED_ROLES: UserRole[] = ['MANAGER', 'OWNER', 'SUPER_ADMIN'];

export function LineItemDiscountControl({ item }: LineItemDiscountControlProps) {
  const { data: session } = useSession();
  const setLineDiscount = useCartStore((s) => s.setLineDiscount);
  const setAuthorizingManager = useCartStore((s) => s.setAuthorizingManager);
  const setActiveLine = useCartStore((s) => s.setActiveLine);

  const [mode, setMode] = useState<'percent' | 'fixed'>('percent');
  const [inputValue, setInputValue] = useState('');
  const [pinModalOpen, setPinModalOpen] = useState(false);

  const role = session?.user?.role;
  const isPrivileged = role != null && PRIVILEGED_ROLES.includes(role);

  const lineTotal = item.unitPrice * item.quantity;
  const parsedInput = parseFloat(inputValue) || 0;

  const effectivePercent =
    mode === 'percent'
      ? parsedInput
      : lineTotal > 0
        ? (parsedInput / lineTotal) * 100
        : 0;

  const discountAmount = (lineTotal * effectivePercent) / 100;
  const newLineTotal = lineTotal - discountAmount;
  const exceedsTotal = newLineTotal < 0;
  const needsOverride = !isPrivileged && effectivePercent > POS_DISCOUNT_THRESHOLDS.lineItemMaxPercent;

  const handleApply = () => {
    if (exceedsTotal) return;
    if (needsOverride) {
      setPinModalOpen(true);
      return;
    }
    setLineDiscount(item.variantId, effectivePercent);
    setActiveLine(null);
  };

  const handlePinSuccess = (managerId: string) => {
    setLineDiscount(item.variantId, effectivePercent);
    setAuthorizingManager(managerId);
    setActiveLine(null);
  };

  return (
    <div className="px-4 py-2 bg-linen/50 border-t border-mist/20">
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
            ? 'Discount exceeds line total'
            : `New line total: ${formatRupee(Math.max(0, newLineTotal))}`}
        </p>
      )}

      <CartManagerPINModal
        open={pinModalOpen}
        onOpenChange={setPinModalOpen}
        description={`Authorise ${effectivePercent.toFixed(1)}% line discount on ${item.productName}${item.variantDescription ? ` / ${item.variantDescription}` : ''}`}
        onSuccess={handlePinSuccess}
      />
    </div>
  );
}
