/**
 * Cart page at `/[tenantSlug]/cart`. Wraps the client-side `<CartView/>`
 * with a server-rendered shell + SEO metadata so the URL is shareable
 * and discoverable.
 */

import type { Metadata } from 'next';
import { getTenantInfo } from '@/lib/api/website';
import { CartView } from '@/components/website/cart/CartView';
import { StoreHeader } from '@/components/website/common/StoreHeader';

interface CartPageProps {
  params: Promise<{ tenantSlug: string }>;
}

export default async function CartPage({ params }: CartPageProps) {
  const { tenantSlug } = await params;
  // Resolve tenant so the header chrome still renders a sensible store name.
  const tenant = await getTenantInfo(tenantSlug).catch(() => null);

  return (
    <div className="min-h-screen bg-[#051610] text-[#cbd5e1]">
      <StoreHeader tenantSlug={tenantSlug} storeName={tenant?.name} />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <CartView tenantSlug={tenantSlug} />
      </main>
    </div>
  );
}

export async function generateMetadata({
  params,
}: CartPageProps): Promise<Metadata> {
  const { tenantSlug } = await params;
  return {
    title: 'Your Cart',
    alternates: { canonical: `/${tenantSlug}/cart` },
  };
}

export const revalidate = 0;
export const dynamicParams = true;