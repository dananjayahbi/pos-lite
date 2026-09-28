/**
 * Checkout return route at `/[tenantSlug]/checkout/return`.
 *
 * PayHere redirects the customer's browser here after an approved payment
 * (`return_url`) or a cancellation (`cancel_url`). PayHere passes **no payment
 * status** in the query string, so this shell only reads the order reference and
 * the optional `cancelled` flag; the client component then reads the real status
 * from the ERP.
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTenantInfo } from '@/lib/api/website';
import { ROUTES } from '@/config/site';
import { CheckoutReturn } from '@/components/website/checkout/CheckoutReturn';
import { StoreHeader } from '@/components/website/common/StoreHeader';

interface CheckoutReturnPageProps {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ order?: string; cancelled?: string }>;
}

// Transactional page — never cache.
export const dynamic = 'force-dynamic';

export default async function CheckoutReturnPage({
  params,
  searchParams,
}: CheckoutReturnPageProps) {
  const { tenantSlug } = await params;
  const sp = await searchParams;

  // Without an order reference there is nothing to confirm — send the customer
  // somewhere useful instead of rendering an empty screen.
  if (!sp.order) {
    redirect(ROUTES.checkout(tenantSlug));
  }

  const tenant = await getTenantInfo(tenantSlug).catch(() => null);

  return (
    <div className="min-h-screen bg-[#051610] text-[#cbd5e1]">
      <StoreHeader tenantSlug={tenantSlug} storeName={tenant?.name} />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <CheckoutReturn
          tenantSlug={tenantSlug}
          orderRef={sp.order}
          wasCancelled={sp.cancelled === '1'}
        />
      </main>
    </div>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Order confirmation',
    description: 'Your order and payment status.',
    robots: { index: false, follow: false },
  };
}
