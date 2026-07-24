import type { Metadata } from 'next';
import { ShopPageContent } from '@/components/website/shared-pages/ShopPageContent';
import { getTenantInfo, getPublicWebsiteConfig } from '@/lib/api/website';
import { SITE } from '@/config/site';

interface ShopPageProps {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ category?: string; sort?: string }>;
}

export default async function ShopPage({ params, searchParams }: ShopPageProps) {
  const tenantSlug = (await params).tenantSlug;
  const category = (await searchParams).category;
  const sort = (await searchParams).sort;
  return (
    <ShopPageContent
      tenantSlug={tenantSlug}
      category={category}
      sort={sort}
    />
  );
}

export async function generateMetadata({
  params,
}: ShopPageProps): Promise<Metadata> {
  const { tenantSlug } = await params;

  try {
    const [tenant, configResponse] = await Promise.all([
      getTenantInfo(tenantSlug),
      getPublicWebsiteConfig(tenantSlug),
    ]);

    if (!tenant) return { title: 'Not Found' };

    const siteName = configResponse?.config?.siteName || tenant.name;
    const title = `Shop — ${siteName}`;
    const description = `Browse all products at ${siteName}.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        locale: 'en_LK',
        siteName,
        url: `${SITE.siteUrl}/${tenantSlug}/shop`,
      },
      alternates: { canonical: `/${tenantSlug}/shop` },
    };
  } catch {
    return { title: 'Shop' };
  }
}

export const revalidate = 60;
