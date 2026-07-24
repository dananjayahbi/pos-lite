import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicProducts } from '@/lib/api/products';
import { getTenantInfo, getPublicWebsiteConfig } from '@/lib/api/website';
import { getPublicCategories } from '@/lib/api/categories';
import { tenantHomePath } from '@/lib/tenant';
import { SITE } from '@/config/site';
import { StaticPageShell } from '@/components/website/static-pages/StaticPageShell';
import { ShopProductGrid } from '@/components/website/shop/ShopProductGrid';
import { ShopFilters } from '@/components/website/shop/ShopFilters';

interface ShopPageProps {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ category?: string; sort?: string }>;
}

export default async function ShopPage({ params, searchParams }: ShopPageProps) {
  const { tenantSlug } = await params;
  const { category, sort } = await searchParams;

  const [tenant, configResponse, productResponse, categories] = await Promise.all([
    getTenantInfo(tenantSlug),
    getPublicWebsiteConfig(tenantSlug),
    getPublicProducts(tenantSlug, {
      ...(category ? { categoryId: category } : {}),
      sort: (sort as 'latest' | 'best-selling' | 'price-asc' | 'price-desc') || 'latest',
      limit: 40,
    }).catch(() => ({ products: [], total: 0 })),
    getPublicCategories(tenantSlug).catch(() => []),
  ]);

  if (!tenant) notFound();

  const config = configResponse?.config;

  return (
    <StaticPageShell
      tenantName={tenant.name}
      tenantSlug={tenantSlug}
      config={config}
      title="Shop"
      description={`Browse all products at ${config?.siteName || tenant.name}`}
    >
      <div className="space-y-6">
        <ShopFilters
          categories={categories}
          tenantSlug={tenantSlug}
          selectedCategory={category}
          selectedSort={sort}
        />
        <ShopProductGrid
          products={productResponse.products}
          tenantSlug={tenantSlug}
        />
      </div>
    </StaticPageShell>
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
