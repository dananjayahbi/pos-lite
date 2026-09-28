'use client';

import React from 'react';

export type PaymentMethodValue = 'COD' | 'CARD';

interface PaymentMethodSelectorProps {
  value: PaymentMethodValue;
  onChange: (value: PaymentMethodValue) => void;
  /** Total to charge (only used for display on the card option). */
  totalLabel: string;
  /**
   * Whether the ERP can complete a card payment. When false the card option is
   * hidden rather than offered and then failing at the gateway.
   */
  cardAvailable?: boolean;
}

const METHODS: { value: PaymentMethodValue; label: string; hint: string }[] = [
  { value: 'COD', label: 'Cash on Delivery', hint: 'Pay when your order arrives' },
  { value: 'CARD', label: 'Pay by Card', hint: 'Secure payment via PayHere' },
];

/**
 * Payment-method selector for the checkout form: Cash on Delivery or card
 * (redirect-based PayHere gateway).
 */
export function PaymentMethodSelector({
  value,
  onChange,
  totalLabel,
  cardAvailable = true,
}: PaymentMethodSelectorProps) {
  // Hide, never disable: an un-selectable radio pair invites the customer to
  // ask why. A storefront that cannot take cards simply offers COD.
  const methods = cardAvailable
    ? METHODS
    : METHODS.filter((method) => method.value !== 'CARD');

  return (
    <fieldset>
      <legend className="mb-3 text-sm font-medium text-[#cbd5e1]">Payment method</legend>
      <div className="space-y-3">
        {methods.map((method) => {
          const active = value === method.value;
          return (
            <label
              key={method.value}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                active ? 'border-[#97c93e] bg-[#97c93e]/10' : 'border-white/10'
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value={method.value}
                checked={active}
                onChange={() => onChange(method.value)}
                className="mt-1 accent-[#97c93e]"
              />
              <span>
                <span className="block text-sm font-medium text-white">
                  {method.label}
                  {method.value === 'CARD' ? ` — ${totalLabel}` : ''}
                </span>
                <span className="block text-xs text-[#94a3b8]">{method.hint}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
