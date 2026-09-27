'use client';

import Link from 'next/link';
import { CheckCircle, Loader2 } from 'lucide-react';
import { ROUTES } from '@/config/site';
import { useOrderPaymentPolling } from '@/hooks/useOrderPaymentPolling';
import { presentPaymentStatus } from '@/lib/paymentPresentation';
import { formatLKR } from '@/lib/utils';
import { PaymentReturnBanner } from '@/components/website/checkout/PaymentReturnBanner';

/**
 * Checkout return / confirmation screen.
 *
 * The customer arrives here from PayHere's `return_url` (or `cancel_url`), which
 * carry **no payment status**. The authoritative outcome is read from the ERP,
 * which learned it from the gateway's server-to-server IPN — so this component
 * polls until the state settles and renders the verdict from
 * `presentPaymentStatus`.
 *
 * A `cancelled=1` query flag only tells us the customer pressed cancel; it never
 * asserts a failure (they may have paid in another tab). The database decides.
 */

interface CheckoutReturnProps {
  tenantSlug: string;
  orderRef: string;
  /** Present when PayHere redirected via `cancel_url`. */
  wasCancelled: boolean;
}

export function CheckoutReturn({
  tenantSlug,
  orderRef,
  wasCancelled,
}: CheckoutReturnProps) {
  const { payment, loading, timedOut, unreachable, refetch } = useOrderPaymentPolling({
    tenantSlug,
    orderRef,
    // Card payments need confirmation; a COD order settles on delivery, but we
    // still read it once so the page can show the total.
    enabled: true,
  });

  const presentation = presentPaymentStatus(
    payment?.paymentStatus ?? 'PENDING',
    {
      wasCancelled,
      paymentMethod: payment?.paymentMethod ?? 'CARD',
    },
  );

  // Still waiting on the very first response.
  if (loading && !payment) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 py-16 text-center">
        <Loader2 size={40} className="animate-spin text-[#97c93e]" aria-hidden />
        <p className="text-[#cbd5e1]">Confirming your order…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle size={48} className="text-[#97c93e]" aria-hidden />
        <h1
          className="text-2xl font-medium text-white"
          style={{ fontFamily: 'var(--font-serif), serif' }}
        >
          Thank you for your order
        </h1>
        <p className="text-sm text-[#94a3b8]">
          Order reference{' '}
          <span className="font-semibold text-[#97c93e]">{orderRef}</span>
        </p>
      </div>

      <PaymentReturnBanner
        tone={presentation.tone}
        title={presentation.title}
        description={presentation.description}
        meta={
          payment
            ? `Total ${formatLKR(payment.total)}${payment.cardMethod ? ` · Paid via ${payment.cardMethod}` : ''}`
            : undefined
        }
      />

      {unreachable && !payment ? (
        <p className="text-center text-sm text-[#94a3b8]">
          We couldn&apos;t reach the store to confirm your payment. Your order is
          safe — please check the tracking page or contact us.
        </p>
      ) : null}

      {timedOut && payment && payment.paymentStatus === 'PENDING' ? (
        <p className="text-center text-sm text-[#94a3b8]">
          This is taking longer than usual. Your payment is still being processed
          — no need to place the order again.
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        {(timedOut || unreachable) && (
          <button
            type="button"
            onClick={refetch}
            className="rounded-full border border-white/15 px-6 py-3 text-sm font-medium uppercase tracking-wider text-[#cbd5e1] transition-colors hover:bg-white/10 hover:text-white"
          >
            Check again
          </button>
        )}
        <Link
          href={ROUTES.track(tenantSlug)}
          className="inline-block rounded-full bg-[#97c93e] px-6 py-3 text-center text-sm font-semibold uppercase tracking-wider text-[#051610] transition-all hover:-translate-y-0.5 hover:bg-[#b2db58]"
        >
          Track Order
        </Link>
        <Link
          href={ROUTES.shop(tenantSlug)}
          className="inline-block rounded-full border border-white/15 px-6 py-3 text-center text-sm font-medium uppercase tracking-wider text-[#cbd5e1] transition-colors hover:bg-white/10 hover:text-white"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
