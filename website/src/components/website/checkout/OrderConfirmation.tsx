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
      <CheckCircle size={56} className="text-[#97c93e]" />
      <h1
        className="text-2xl font-medium text-white"
        style={{ fontFamily: 'var(--font-serif), serif' }}
      >
        Order placed!
      </h1>
      <p className="text-[#cbd5e1]">
        Your order reference is{' '}
        <span className="font-semibold text-[#97c93e]">{orderRef}</span>. We&apos;ll
        contact you on delivery for payment.
      </p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <Link
          href={ROUTES.track(tenantSlug)}
          className="inline-block rounded-full bg-[#97c93e] px-6 py-3 text-sm font-semibold uppercase tracking-wider text-[#051610] transition-all hover:-translate-y-0.5 hover:bg-[#b2db58] hover:shadow-[0_8px_25px_rgba(151,201,62,0.3)]"
        >
          Track Order
        </Link>
        <Link
          href={ROUTES.shop(tenantSlug)}
          className="inline-block rounded-full border border-white/15 px-6 py-3 text-sm font-medium uppercase tracking-wider text-[#cbd5e1] transition-colors hover:bg-white/10 hover:text-white"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
