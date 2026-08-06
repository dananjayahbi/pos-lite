/**
 * Checkout page at `/[tenantSlug]/checkout`. Server-rendered shell that wraps
 * the client-side `<CheckoutForm/>` and resolves the tenant for the header.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { tenantHomePath } from '@/lib/tenant';
import { getTenantInfo } from '@/lib/api/website';
import { CheckoutForm } from '@/components/website/checkout/CheckoutForm';

interface CheckoutPageProps {
  params: Promise<{ tenantSlug: string }>;
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { tenantSlug } = await params;
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

      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1
          className="mb-6 text-2xl font-medium"
          style={{ fontFamily: 'var(--font-dm-serif), serif' }}
        >
          Checkout
        </h1>
        <CheckoutForm tenantSlug={tenantSlug} />
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
