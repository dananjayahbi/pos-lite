/**
 * Checkout page at `/[tenantSlug]/checkout`. Server-rendered shell that wraps
 * the client-side `<CheckoutForm/>` and resolves the tenant for the header.
 */

import type { Metadata } from 'next';
import { getTenantInfo } from '@/lib/api/website';
import { isCardPaymentAvailable } from '@/lib/api/payhereAvailability';
import { CheckoutForm } from '@/components/website/checkout/CheckoutForm';
import { StoreHeader } from '@/components/website/common/StoreHeader';

interface CheckoutPageProps {
  params: Promise<{ tenantSlug: string }>;
}

// Checkout is a transactional page — never cache it.
export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { tenantSlug } = await params;
  const [tenant, cardAvailable] = await Promise.all([
    getTenantInfo(tenantSlug).catch(() => null),
    // The card option is only offered when the ERP reports it can complete a
    // payment — otherwise the customer is sent to a gateway that will fail.
    isCardPaymentAvailable(),
  ]);

  return (
    <div className="min-h-screen bg-[#051610] text-[#cbd5e1]">
      <StoreHeader tenantSlug={tenantSlug} storeName={tenant?.name} />

      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1
          className="mb-6 text-2xl font-medium text-white"
          style={{ fontFamily: 'var(--font-serif), serif' }}
        >
          Checkout
        </h1>
        <CheckoutForm tenantSlug={tenantSlug} cardPaymentAvailable={cardAvailable} />
      </main>
    </div>
  );
}

export async function generateMetadata({ params }: CheckoutPageProps): Promise<Metadata> {
  const { tenantSlug } = await params;
  const tenant = await getTenantInfo(tenantSlug).catch(() => null);
  return {
    title: `${tenant?.name ?? 'Store'} — Checkout`,
    description: 'Place your order for cash on delivery.',
  };
}
