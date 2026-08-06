"use client";

/**
 * Guest checkout form: captures the shipping address, submits the order via the
 * ERP public endpoint, and shows a confirmation with the order reference.
 */

import { useState } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/config/site';
import { useCartStore } from '@/stores/cartStore';
import { computeCartTotals } from '@/lib/cart';
import { placeOrder } from '@/lib/api/delivery';
import { CheckoutAddressSchema } from '@/lib/validators/address';
import { CheckoutSummary } from '@/components/website/checkout/CheckoutSummary';
import { OrderConfirmation } from '@/components/website/checkout/OrderConfirmation';

interface CheckoutFormProps {
  tenantSlug: string;
}

const FIELD_LABELS: Record<string, string> = {
  fullName: 'Full name',
  phone: 'Phone',
  phone2: 'Alternate phone (optional)',
  addressLine1: 'Address line 1',
  addressLine2: 'Address line 2 (optional)',
  cityName: 'City',
  districtName: 'District (optional)',
  postalCode: 'Postal code (optional)',
};

export function CheckoutForm({ tenantSlug }: CheckoutFormProps) {
  const lines = useCartStore((s) => s.carts[tenantSlug]?.lines ?? []);
  const clear = useCartStore((s) => s.clear);

  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ orderRef: string } | null>(null);

  const totals = computeCartTotals(lines);

  const setValue = (key: string, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = CheckoutAddressSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      const result = await placeOrder(tenantSlug, parsed.data, lines, {
        codAmount: totals.subtotal,
        itemCount: totals.itemCount,
      });
      clear(tenantSlug);
      setConfirmed({ orderRef: result.orderRef });
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : 'Could not place your order' });
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    return <OrderConfirmation tenantSlug={tenantSlug} orderRef={confirmed.orderRef} />;
  }

  if (lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-500">Your cart is empty.</p>
        <Link
          href={ROUTES.shop(tenantSlug)}
          className="mt-4 inline-block rounded bg-black px-6 py-3 text-sm font-medium uppercase tracking-wider text-white hover:bg-gray-800"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-2">
      {/* Address */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2
          className="mb-4 text-lg font-medium"
          style={{ fontFamily: 'var(--font-dm-serif), serif' }}
        >
          Delivery address
        </h2>
        <div className="space-y-4">
          {Object.keys(FIELD_LABELS).map((key) => (
            <div key={key}>
              <label htmlFor={key} className="mb-1 block text-sm font-medium text-gray-700">
                {FIELD_LABELS[key]}
              </label>
              <input
                id={key}
                value={values[key] ?? ''}
                onChange={(e) => setValue(key, e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-black focus:outline-none"
              />
              {errors[key] && <p className="mt-1 text-xs text-red-600">{errors[key]}</p>}
            </div>
          ))}
        </div>

        {errors.form && (
          <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{errors.form}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded bg-black px-6 py-3 text-sm font-medium uppercase tracking-wider text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
        >
          {submitting ? 'Placing order…' : 'Place order (COD)'}
        </button>
      </div>

      {/* Summary */}
      <CheckoutSummary tenantSlug={tenantSlug} lines={lines} />
    </form>
  );
}
