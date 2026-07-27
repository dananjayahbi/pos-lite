import type { Metadata } from 'next';
import { ContactPageContent } from '@/components/website/shared-pages/ContactPageContent';
import { getTenantInfo, getPublicWebsiteConfig } from '@/lib/api/website';
import { SITE } from '@/config/site';

interface ContactPageProps {
  params: Promise<{ tenantSlug: string }>;
}

export default async function ContactPage({ params }: ContactPageProps) {
  const contactSlug = (await params).tenantSlug;
  return <ContactPageContent tenantSlug={contactSlug} />;
}

export async function generateMetadata({
  params,
}: ContactPageProps): Promise<Metadata> {
  const { tenantSlug } = await params;

  try {
    const [tenant, configResponse] = await Promise.all([
      getTenantInfo(tenantSlug),
      getPublicWebsiteConfig(tenantSlug),
    ]);

    if (!tenant) return { title: 'Not Found' };

    const siteName = configResponse?.config?.siteName || tenant.name;
    const title =
      configResponse?.config?.contactPageTitle ||
      `Contact — ${siteName}`;
    const description = `Get in touch with ${siteName}.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        locale: 'en_LK',
        siteName,
        url: `${SITE.siteUrl}/${tenantSlug}/contact`,
      },
      alternates: { canonical: `/${tenantSlug}/contact` },
    };
  } catch {
    return { title: 'Contact' };
  }
}

// Dynamic rendering — this page fetches live data from the ERP backend
// which must be reachable at request time (not build time).
export const dynamic = 'force-dynamic';
