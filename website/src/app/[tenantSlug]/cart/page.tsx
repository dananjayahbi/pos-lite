/**
 * Cart page at `/[tenantSlug]/cart`. Wraps the client-side `<CartView/>`
 * with a server-rendered shell + SEO metadata so the URL is shareable
 * and discoverable.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { tenantHomePath } from '@/lib/tenant';
import { getTenantInfo } from '@/lib/api/website';
import { CartView } from '@/components/website/cart/CartView';

interface CartPageProps {
  params: Promise<{ tenantSlug: string }>;
}

export default async function CartPage({ params }: CartPageProps) {
  const { tenantSlug } = await params;
  // Resolve tenant so the header chrome still renders a sensible store name.
  const tenant = await getTenantInfo(tenantSlug).catch(() => null);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
          <Link
            href={tenantHomePath(tenantSlug)}
            className="text-lg font-medium"
            style={{ fontFamily: 'var(--font-dm-serif), serif' }}
          >
            {tenant?.name ?? 'Store'}
          </Link>
          <Link
            href={tenantHomePath(tenantSlug)}
            className="text-sm text-gray-500 hover:text-black transition-colors"
          >
            ← Back to store
          </Link>
        </div>
      </header>

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