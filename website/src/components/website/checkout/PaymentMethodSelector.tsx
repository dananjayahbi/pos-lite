'use client';

import React from 'react';

export type PaymentMethodValue = 'COD' | 'CARD';

interface PaymentMethodSelectorProps {
  value: PaymentMethodValue;
  onChange: (value: PaymentMethodValue) => void;
  /** Total to charge (only used for display on the card option). */
  totalLabel: string;
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
}: PaymentMethodSelectorProps) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-medium text-gray-700">Payment method</legend>
      <div className="space-y-3">
        {METHODS.map((method) => {
          const active = value === method.value;
          return (
            <label
              key={method.value}
              className={`flex cursor-pointer items-start gap-3 rounded border p-3 transition-colors ${
                active ? 'border-black bg-gray-50' : 'border-gray-200'
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value={method.value}
                checked={active}
                onChange={() => onChange(method.value)}
                className="mt-1 accent-black"
              />
              <span>
                <span className="block text-sm font-medium text-gray-800">
                  {method.label}
                  {method.value === 'CARD' ? ` — ${totalLabel}` : ''}
                </span>
                <span className="block text-xs text-gray-500">{method.hint}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
