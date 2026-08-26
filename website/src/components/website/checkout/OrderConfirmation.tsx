"use client";

/** Post-submit confirmation screen with the generated order reference. */

import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { ROUTES } from '@/config/site';

interface OrderConfirmationProps {
  tenantSlug: string;
  orderRef: string;
}

export function OrderConfirmation({ tenantSlug, orderRef }: OrderConfirmationProps) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center justify-center gap-4 py-16 text-center">
      <CheckCircle size={56} className="text-green-600" />
      <h1
        className="text-2xl font-medium"
        style={{ fontFamily: 'var(--font-dm-serif), serif' }}
      >
        Order placed!
      </h1>
      <p className="text-gray-600">
        Your order reference is{' '}
        <span className="font-semibold text-gray-900">{orderRef}</span>. We&apos;ll
        contact you on delivery for payment.
      </p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <Link
          href={ROUTES.track(tenantSlug)}
          className="inline-block rounded bg-black px-6 py-3 text-sm font-medium uppercase tracking-wider text-white hover:bg-gray-800"
        >
          Track Order
        </Link>
        <Link
          href={ROUTES.shop(tenantSlug)}
          className="inline-block rounded border border-gray-300 px-6 py-3 text-sm font-medium uppercase tracking-wider text-gray-700 hover:border-gray-500"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
