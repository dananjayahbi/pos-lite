"use client";

/** Order summary shown during checkout (items + COD total). */

import { formatLKR } from '@/lib/utils';
import { computeCartTotals } from '@/lib/cart';
import type { CartLine } from '@/stores/cartStore';

interface CheckoutSummaryProps {
  tenantSlug: string;
  lines: CartLine[];
}

export function CheckoutSummary({ lines }: CheckoutSummaryProps) {
  const totals = computeCartTotals(lines);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2
        className="mb-4 text-lg font-medium"
        style={{ fontFamily: 'var(--font-dm-serif), serif' }}
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
              <div className="h-12 w-12 rounded bg-gray-100" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">{line.productName}</p>
              <p className="text-xs text-gray-500">Qty {line.quantity}</p>
            </div>
            <p className="text-sm font-medium text-gray-800">
              {formatLKR(line.quantity * line.price)}
            </p>
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Subtotal</span>
          <span className="font-medium text-gray-800">{totals.formattedSubtotal}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Delivery</span>
          <span className="text-gray-500">Calculated on delivery</span>
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 pt-2">
          <span className="font-medium text-gray-800">COD total</span>
          <span className="text-lg font-semibold text-gray-900">{totals.formattedSubtotal}</span>
        </div>
      </div>

      <p className="mt-4 rounded bg-gray-50 px-3 py-2 text-xs text-gray-500">
        You will pay <strong>cash on delivery</strong> when your order arrives.
      </p>
    </div>
  );
}
