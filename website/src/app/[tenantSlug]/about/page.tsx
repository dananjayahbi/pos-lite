import type { Metadata } from 'next';
import { AboutPageContent } from '@/components/website/shared-pages/AboutPageContent';
import { getTenantInfo, getPublicWebsiteConfig } from '@/lib/api/website';
import { SITE } from '@/config/site';

interface AboutPageProps {
  params: Promise<{ tenantSlug: string }>;
}

export default async function AboutPage({ params }: AboutPageProps) {
  const { tenantSlug } = await params;
  return <AboutPageContent tenantSlug={tenantSlug} />;
}

export async function generateMetadata({
  params,
}: AboutPageProps): Promise<Metadata> {
  const { tenantSlug } = await params;

  try {
    const [tenant, configResponse] = await Promise.all([
      getTenantInfo(tenantSlug),
      getPublicWebsiteConfig(tenantSlug),
    ]);

    if (!tenant) return { title: 'Not Found' };

    const siteName = configResponse?.config?.siteName || tenant.name;
    const title =
      configResponse?.config?.aboutPageTitle ||
      `About — ${siteName}`;
    const description =
      configResponse?.config?.metaDescription ||
      `Learn more about ${siteName}.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        locale: 'en_LK',
        siteName,
        url: `${SITE.siteUrl}/${tenantSlug}/about`,
      },
      alternates: { canonical: `/${tenantSlug}/about` },
    };
  } catch {
    return { title: 'About' };
  }
}

// Dynamic rendering — this page fetches live data from the ERP backend
// which must be reachable at request time (not build time).
export const dynamic = 'force-dynamic';
