import { notFound } from 'next/navigation';
import { getPublicProducts } from '@/lib/api/products';
import { getTenantInfo, getPublicWebsiteConfig } from '@/lib/api/website';
import { getPublicCategories } from '@/lib/api/categories';
import { StaticPageShell } from '../static-pages/StaticPageShell';
import { ShopProductGrid } from '../shop/ShopProductGrid';
import { ShopFilters } from '../shop/ShopFilters';

interface ShopPageContentProps {
  tenantSlug: string;
  category?: string;
  sort?: string;
}

export async function ShopPageContent({ tenantSlug, category, sort }: ShopPageContentProps) {
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
  const shopTitle = config?.shopPageTitle || 'Shop';
  const shopSubtitle = config?.shopPageSubtitle;

  const subtitleProps = shopSubtitle ? { subtitle: shopSubtitle } : {};
  const heroProps = config?.shopHeroImageUrl ? { heroImageUrl: config.shopHeroImageUrl } : {};

  return (
    <StaticPageShell
      tenantName={tenant.name}
      tenantSlug={tenantSlug}
      config={config}
      title={shopTitle}
      {...subtitleProps}
      {...heroProps}
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
