// filepath: src/app/[tenantSlug]/page.tsx
// Public storefront at /[tenantSlug]. This is a thin wrapper around the
// shared <Storefront/> server component — all data fetching and rendering
// lives in the component so the root URL and tenant URLs stay in sync.

import type { Metadata } from 'next';
import { Storefront } from '@/components/website/Storefront';
import { getTenantInfo, getPublicWebsiteConfig } from '@/lib/api/website';
import { SITE } from '@/config/site';

interface StorefrontPageProps {
  params: Promise<{ tenantSlug: string }>;
}

export default async function StorefrontPage({ params }: StorefrontPageProps) {
  const { tenantSlug } = await params;
  return <Storefront tenantSlug={tenantSlug} />;
}

/**
 * SEO metadata derived from the ERP-managed website config.
 */
export async function generateMetadata({
  params,
}: StorefrontPageProps): Promise<Metadata> {
  const { tenantSlug } = await params;

  try {
    const [tenant, configResponse] = await Promise.all([
      getTenantInfo(tenantSlug),
      getPublicWebsiteConfig(tenantSlug),
    ]);

    if (!tenant) return { title: 'Not Found' };

    const config = configResponse?.config;
    const title = config?.metaTitle || config?.siteName || tenant.name;
    const description =
      config?.metaDescription ||
      `Discover premium Ayurveda products at ${tenant.name}.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        siteName: tenant.name,
        locale: 'en_LK',
        type: 'website',
        url: `${SITE.siteUrl}/${tenant.slug}`,
        ...(tenant.logoUrl ? { images: [{ url: tenant.logoUrl }] } : {}),
      },
      alternates: {
        canonical: `/${tenant.slug}`,
      },
      robots: { index: true, follow: true },
    };
  } catch {
    return { title: 'Storefront' };
  }
}

// Dynamic rendering — this page fetches live data from the ERP backend
// which must be reachable at request time (not build time).
export const dynamic = 'force-dynamic';
export const dynamicParams = true;