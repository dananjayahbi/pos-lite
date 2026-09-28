"use client";

/** Order summary shown during checkout (items + delivery fee + total). */

import { formatLKR } from '@/lib/utils';
import { computeCartTotals } from '@/lib/cart';
import type { CartLine } from '@/stores/cartStore';

interface CheckoutSummaryProps {
  tenantSlug: string;
  lines: CartLine[];
  /** Server-computed delivery fee (2dp string). When null, not yet priced. */
  shippingFee?: string | null;
}

export function CheckoutSummary({ lines, shippingFee }: CheckoutSummaryProps) {
  const totals = computeCartTotals(lines);
  const fee = shippingFee !== null && shippingFee !== undefined ? Number(shippingFee) : null;
  const orderTotal = totals.subtotal + (fee ?? 0);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#082017]/70 p-4 backdrop-blur-sm">
      <h2
        className="mb-4 text-lg font-medium text-white"
        style={{ fontFamily: 'var(--font-serif), serif' }}
      >
        Your order
      </h2>

      <ul className="space-y-3">
        {lines.map((line) => (
          <li key={line.variantId} className="flex items-start gap-3">
            {line.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={line.image}
                alt={line.productName}
                className="h-12 w-12 rounded object-cover"
              />
            ) : (
              <div className="h-12 w-12 rounded bg-[#051610] ring-1 ring-white/10" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-white">{line.productName}</p>
              <p className="text-xs text-[#94a3b8]">Qty {line.quantity}</p>
            </div>
            <p className="text-sm font-medium text-white">
              {formatLKR(line.quantity * line.price)}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-[#94a3b8]">Subtotal</span>
          <span className="font-medium text-white">{totals.formattedSubtotal}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#94a3b8]">Delivery</span>
          {fee === null ? (
            <span className="text-[#64748b]">Calculated on delivery</span>
          ) : (
            <span className="font-medium text-white">{formatLKR(fee)}</span>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-white/10 pt-2">
          <span className="font-medium text-white">Order total</span>
          <span className="text-lg font-semibold text-[#97c93e]">{formatLKR(orderTotal)}</span>
        </div>
      </div>

      <p className="mt-4 rounded bg-white/5 px-3 py-2 text-xs text-[#94a3b8]">
        You will pay <strong className="text-white">cash on delivery</strong> when your order arrives.
      </p>
    </div>
  );
}
