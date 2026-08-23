import type { Metadata } from 'next';
import { ShopPageContent } from '@/components/website/shared-pages/ShopPageContent';
import { getTenantInfo, getPublicWebsiteConfig } from '@/lib/api/website';
import { SITE } from '@/config/site';

interface ShopPageProps {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{
    category?: string;
    sort?: string;
    priceMin?: string;
    priceMax?: string;
    concern?: string;
    form?: string;
    q?: string;
  }>;
}

export default async function ShopPage({ params, searchParams }: ShopPageProps) {
  const tenantSlug = (await params).tenantSlug;
  const sp = await searchParams;
  return (
    <ShopPageContent
      tenantSlug={tenantSlug}
      category={sp.category ?? ''}
      sort={sp.sort ?? ''}
      priceMin={sp.priceMin}
      priceMax={sp.priceMax}
      concern={sp.concern ?? ''}
      form={sp.form ?? ''}
      q={sp.q ?? ''}
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

// Dynamic rendering — this page fetches live data from the ERP backend
// which must be reachable at request time (not build time).
export const dynamic = 'force-dynamic';
