/**
 * Order-tracking page at `/[tenantSlug]/track`. Server-rendered shell that
 * resolves the tenant for the header and renders the client-side lookup form.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { tenantHomePath } from '@/lib/tenant';
import { getTenantInfo } from '@/lib/api/website';
import { TrackingLookupForm } from '@/components/website/tracking/TrackingLookupForm';

interface TrackPageProps {
  params: Promise<{ tenantSlug: string }>;
}

export const dynamic = 'force-dynamic';

export default async function TrackPage({ params }: TrackPageProps) {
  const { tenantSlug } = await params;
  const tenant = await getTenantInfo(tenantSlug).catch(() => null);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link
            href={tenantHomePath(tenantSlug)}
            className="text-lg font-medium"
            style={{ fontFamily: 'var(--font-dm-serif), serif' }}
          >
            {tenant?.name ?? 'Store'}
          </Link>
          <Link
            href={tenantHomePath(tenantSlug)}
            className="text-sm text-gray-500 transition-colors hover:text-black"
          >
            ← Back to store
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1
          className="mb-1 text-2xl font-medium"
          style={{ fontFamily: 'var(--font-dm-serif), serif' }}
        >
          Track your order
        </h1>
        <p className="mb-6 text-sm text-gray-500">
          Enter your order reference or phone number to see the latest delivery
          status and timeline.
        </p>
        <TrackingLookupForm tenantSlug={tenantSlug} />
      </main>
    </div>
  );
}

export async function generateMetadata({ params }: TrackPageProps): Promise<Metadata> {
  const { tenantSlug } = await params;
  const tenant = await getTenantInfo(tenantSlug).catch(() => null);
  return {
    title: `${tenant?.name ?? 'Store'} — Track Order`,
    description: 'Track your order and see the latest delivery status.',
  };
}
