"use client";

/**
 * Guest checkout form: captures the shipping address, submits the order via the
 * ERP public endpoint, and shows a confirmation with the order reference.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/config/site';
import { useCartStore } from '@/stores/cartStore';
import { computeCartTotals } from '@/lib/cart';
import { formatLKR } from '@/lib/utils';
import { placeOrder } from '@/lib/api/delivery';
import { getShippingQuote } from '@/lib/api/shippingQuote';
import { submitPayHereRedirect } from '@/lib/payhereRedirect';
import { CheckoutAddressSchema } from '@/lib/validators/address';
import { CheckoutSummary } from '@/components/website/checkout/CheckoutSummary';
import { OrderConfirmation } from '@/components/website/checkout/OrderConfirmation';
import {
  PaymentMethodSelector,
  type PaymentMethodValue,
} from '@/components/website/checkout/PaymentMethodSelector';

interface CheckoutFormProps {
  tenantSlug: string;
  /** False when the ERP cannot complete a card payment (see the checkout page). */
  cardPaymentAvailable?: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  fullName: 'Full name',
  phone: 'Phone',
  phone2: 'Alternate phone (optional)',
  email: 'Email',
  addressLine1: 'Address line 1',
  addressLine2: 'Address line 2 (optional)',
  cityName: 'City',
  districtName: 'District (optional)',
  postalCode: 'Postal code (optional)',
};

/** Fields the customer must fill before we can send them to PayHere. */
const CARD_REQUIRED_FIELDS = ['email'] as const;

export function CheckoutForm({ tenantSlug, cardPaymentAvailable = true }: CheckoutFormProps) {
  const lines = useCartStore((s) => s.carts[tenantSlug]?.lines ?? []);
  const clear = useCartStore((s) => s.clear);

  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  // Never idle on CARD when the gateway is unavailable — the option is hidden,
  // so a stale selection would submit a payment method that cannot complete.
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>('COD');
  const effectivePaymentMethod: PaymentMethodValue = cardPaymentAvailable
    ? paymentMethod
    : 'COD';
  const [confirmed, setConfirmed] = useState<{ orderRef: string } | null>(null);
  // Server-computed delivery-fee estimate (2dp string), requested once the
  // destination city is entered so the fee is visible before payment.
  const [shippingFee, setShippingFee] = useState<string | null>(null);

  const totals = computeCartTotals(lines);
  const shippingFeeNum =
    shippingFee !== null && shippingFee !== undefined ? Number(shippingFee) : 0;
  const orderTotalLabel = formatLKR(totals.subtotal + shippingFeeNum);

  // Request a delivery-fee quote whenever the destination changes. The quote is
  // display-only; the authoritative fee is recomputed server-side on placement.
  useEffect(() => {
    let active = true;
    const city = values.cityName?.trim();
    if (!city) {
      setShippingFee(null);
      return;
    }
    getShippingQuote(tenantSlug, {
      cityName: city,
      districtName: values.districtName?.trim() || undefined,
    }).then((quote) => {
      if (active && quote) setShippingFee(quote.shippingFee);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug, values.cityName, values.districtName]);

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

    // PayHere rejects a checkout without a valid email, so catch it here rather
    // than letting the customer reach the gateway and fail.
    if (effectivePaymentMethod === 'CARD') {
      const missing = CARD_REQUIRED_FIELDS.filter((key) => !values[key]?.trim());
      if (missing.length > 0) {
        setErrors(
          Object.fromEntries(
            missing.map((key) => [key, 'Required for card payments']),
          ),
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const result = await placeOrder(tenantSlug, parsed.data, lines, {
        codAmount: totals.subtotal,
        itemCount: totals.itemCount,
        paymentMethod: effectivePaymentMethod,
      });
      clear(tenantSlug);

      // Card orders redirect to PayHere to complete payment. PayHere returns the
      // browser to the checkout-return page (see `return_url`), which re-reads
      // the real payment status from the ERP.
      if (result.payment) {
        submitPayHereRedirect(result.payment.payhereUrl, result.payment.payload);
        return;
      }

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
        <p className="text-[#94a3b8]">Your cart is empty.</p>
        <Link
          href={ROUTES.shop(tenantSlug)}
          className="mt-4 inline-block rounded-full bg-[#97c93e] px-6 py-3 text-sm font-semibold uppercase tracking-wider text-[#051610] hover:bg-[#b2db58] transition-all"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-2">
      {/* Address */}
      <div className="rounded-2xl border border-white/10 bg-[#082017]/70 p-4 backdrop-blur-sm">
        <h2
          className="mb-4 text-lg font-medium text-white"
          style={{ fontFamily: 'var(--font-serif), serif' }}
        >
          Delivery address
        </h2>
        <div className="space-y-4">
          {Object.keys(FIELD_LABELS).map((key) => {
            const isEmail = key === 'email';
            const emailRequired = isEmail && effectivePaymentMethod === 'CARD';
            return (
              <div key={key}>
                <label htmlFor={key} className="mb-1 block text-sm font-medium text-[#cbd5e1]">
                  {FIELD_LABELS[key]}
                  {emailRequired ? (
                    <span className="ml-1 text-[#97c93e]">*</span>
                  ) : (
                    isEmail && (
                      <span className="ml-1 text-xs text-[#64748b]">
                        (required for card payments)
                      </span>
                    )
                  )}
                </label>
                <input
                  id={key}
                  type={isEmail ? 'email' : 'text'}
                  autoComplete={isEmail ? 'email' : undefined}
                  value={values[key] ?? ''}
                  onChange={(e) => setValue(key, e.target.value)}
                  className="w-full rounded-lg border border-white/12 bg-[#051610] px-3 py-2 text-sm text-white focus:border-[#97c93e] focus:outline-none"
                />
                {errors[key] && <p className="mt-1 text-xs text-red-400">{errors[key]}</p>}
              </div>
            );
          })}
        </div>

        {errors.form && (
          <p className="mt-4 rounded bg-red-400/10 px-3 py-2 text-sm text-red-300">{errors.form}</p>
        )}

        <div className="mt-6">
          <PaymentMethodSelector
            value={effectivePaymentMethod}
            onChange={setPaymentMethod}
            totalLabel={orderTotalLabel}
            cardAvailable={cardPaymentAvailable}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-4 w-full rounded-full bg-[#97c93e] px-6 py-3 text-sm font-semibold uppercase tracking-wider text-[#051610] transition-all hover:-translate-y-0.5 hover:bg-[#b2db58] hover:shadow-[0_8px_25px_rgba(151,201,62,0.3)] disabled:opacity-50"
        >
          {submitting
            ? 'Placing order…'
            : effectivePaymentMethod === 'CARD'
              ? 'Place order & pay'
              : 'Place order (COD)'}
        </button>
      </div>

      {/* Summary */}
      <CheckoutSummary tenantSlug={tenantSlug} lines={lines} shippingFee={shippingFee} />
    </form>
  );
}
