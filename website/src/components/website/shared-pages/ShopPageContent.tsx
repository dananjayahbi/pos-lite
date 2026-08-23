import { notFound } from 'next/navigation';
import { getPublicProducts, type ProductListResponse } from '@/lib/api/products';
import { getPublicShopFilters } from '@/lib/api/shopFilters';
import { priceBounds } from '@/lib/api/shopQuery';
import { getTenantInfo, getPublicWebsiteConfig } from '@/lib/api/website';
import { getPublicCategories } from '@/lib/api/categories';
import { StaticPageShell } from '../static-pages/StaticPageShell';
import { ShopProductGrid } from '../shop/ShopProductGrid';
import { ShopFilters } from '../shop/ShopFilters';

interface ShopPageContentProps {
  tenantSlug: string;
  category?: string | undefined;
  sort?: string | undefined;
  priceMin?: string | undefined;
  priceMax?: string | undefined;
  concern?: string | undefined;
  form?: string | undefined;
  q?: string | undefined;
}

/** Parse a numeric query param to a number, or undefined if invalid/absent. */
function toNumber(raw?: string): number | undefined {
  if (raw === undefined || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export async function ShopPageContent({
  tenantSlug,
  category,
  sort,
  priceMin,
  priceMax,
  concern,
  form,
  q,
}: ShopPageContentProps) {
  let tenant = null;
  let configResponse = null;
  let productResponse: ProductListResponse = { products: [], total: 0 };
  let categories: Awaited<ReturnType<typeof getPublicCategories>> = [];

  try {
    [tenant, configResponse, productResponse, categories] = await Promise.all([
      getTenantInfo(tenantSlug),
      getPublicWebsiteConfig(tenantSlug),
      getPublicProducts(tenantSlug, {
        ...(category ? { categoryId: category } : {}),
        priceMin: toNumber(priceMin),
        priceMax: toNumber(priceMax),
        ...(concern ? { concern } : {}),
        ...(form ? { form } : {}),
        ...(q ? { q } : {}),
        sort: (sort as 'latest' | 'best-selling' | 'price-asc' | 'price-desc') || 'latest',
        limit: 40,
      }).catch(() => ({ products: [], total: 0 })),
      getPublicCategories(tenantSlug).catch(() => []),
    ]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[shop] tenant/config fetch failed', err);
  }

  if (!tenant) notFound();

  const config = configResponse?.config;
  const shopTitle = config?.shopPageTitle || 'Shop';
  const shopSubtitle = config?.shopPageSubtitle;

  const subtitleProps = shopSubtitle ? { subtitle: shopSubtitle } : {};
  const heroProps = config?.shopHeroImageUrl ? { heroImageUrl: config.shopHeroImageUrl } : {};

  // Filter options + price bounds (seeded from the current catalog).
  const shopFilters = await getPublicShopFilters(tenantSlug);
  const bounds = priceBounds(productResponse.products);

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
          concerns={shopFilters.concerns}
          forms={shopFilters.forms}
          selectedConcern={concern}
          selectedForm={form}
          priceMin={toNumber(priceMin)}
          priceMax={toNumber(priceMax)}
          priceBounds={bounds}
        />
        <ShopProductGrid
          products={productResponse.products}
          tenantSlug={tenantSlug}
          query={q}
        />
      </div>
    </StaticPageShell>
  );
}
