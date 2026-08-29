import { notFound } from 'next/navigation';
import { getPublicProducts, type ProductListResponse } from '@/lib/api/products';
import { getPublicShopFilters } from '@/lib/api/shopFilters';
import { getTenantInfo, getPublicWebsiteConfig } from '@/lib/api/website';
import { getPublicCategories } from '@/lib/api/categories';
import { StaticPageShell } from '../static-pages/StaticPageShell';
import { ShopCatalogClient } from '../shop/ShopCatalogClient';
import type { ShopFilterState } from '../shop/useShopFilters';
import type { PublicConcern } from '@/types/website.types';

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
  let concerns: PublicConcern[] = [];
  let forms: string[] = [];

  try {
    // Fetch the FULL catalog (no server-side filtering) so the client wrapper
    // can filter/refine instantly without a reload. Also pull categories and
    // the shop-filter options (concern / form) for the sidebar.
    const [tenantRes, cfgRes, prodRes, catRes, shopFilters] = await Promise.all([
      getTenantInfo(tenantSlug),
      getPublicWebsiteConfig(tenantSlug),
      getPublicProducts(tenantSlug, { limit: 100 }).catch(() => ({ products: [], total: 0 })),
      getPublicCategories(tenantSlug).catch(() => []),
      getPublicShopFilters(tenantSlug).catch(() => ({ concerns: [], forms: [] })),
    ]);
    tenant = tenantRes;
    configResponse = cfgRes;
    productResponse = prodRes;
    categories = catRes;
    concerns = shopFilters?.concerns ?? [];
    forms = shopFilters?.forms ?? [];
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[shop] tenant/config fetch failed', err);
  }

  if (!tenant) notFound();

  const config = configResponse?.config;
  const shopTitle = config?.shopPageTitle || 'Shop';
  const shopSubtitle = config?.shopPageSubtitle;
  const shopDescription = config?.shopPageDescription;

  const subtitleProps = shopSubtitle ? { subtitle: shopSubtitle } : {};
  const descriptionProps = shopDescription ? { description: shopDescription } : {};
  const heroProps = config?.shopHeroImageUrl ? { heroImageUrl: config.shopHeroImageUrl } : {};

  // Initial filter state derived from the URL search params.
  const initialMin = toNumber(priceMin);
  const initialMax = toNumber(priceMax);
  const initial: ShopFilterState = {
    ...(category ? { category } : {}),
    ...(sort ? { sort } : {}),
    ...(initialMin !== undefined ? { priceMin: initialMin } : {}),
    ...(initialMax !== undefined ? { priceMax: initialMax } : {}),
    ...(concern ? { concern } : {}),
    ...(form ? { form } : {}),
    ...(q ? { q } : {}),
  };

  const clientProps = {
    tenantSlug,
    products: productResponse.products,
    categories,
    concerns,
    forms,
    initial,
  };

  return (
    <StaticPageShell
      tenantName={tenant.name}
      tenantSlug={tenantSlug}
      config={config}
      title={shopTitle}
      {...subtitleProps}
      {...descriptionProps}
      {...heroProps}
    >
      <section id="shop-catalog-section" className="relative w-full py-16 sm:py-20 lg:py-24 overflow-hidden">
        <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-10 lg:px-16">
          <ShopCatalogClient {...clientProps} />
        </div>
      </section>
    </StaticPageShell>
  );
}
