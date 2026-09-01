import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicCategory } from '@/lib/api/categories';
import { getPublicProducts } from '@/lib/api/products';
import { getTenantInfo } from '@/lib/api/website';
import { tenantHomePath } from '@/lib/tenant';
import { SITE } from '@/config/site';
import { CategoryBreadcrumb } from '@/components/website/category/CategoryBreadcrumb';
import { CategoryHeader } from '@/components/website/category/CategoryHeader';
import { CategoryProductGrid } from '@/components/website/category/CategoryProductGrid';
import { StoreHeader } from '@/components/website/common/StoreHeader';

interface CategoryPageProps {
  params: Promise<{ tenantSlug: string; categoryId: string }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { tenantSlug, categoryId } = await params;

  // Fetch category, tenant, and products in parallel
  const [category, tenant, productResponse] = await Promise.all([
    getPublicCategory(tenantSlug, categoryId),
    getTenantInfo(tenantSlug),
    getPublicProducts(tenantSlug, { categoryId, limit: 40 }).catch(() => ({
      products: [],
      total: 0,
    })),
  ]);

  if (!category || !tenant) notFound();

  return (
    <div className="min-h-screen bg-[#051610] text-[#cbd5e1]">
      {/* Common top bar with cart button */}
      <StoreHeader tenantSlug={tenantSlug} storeName={tenant.name} />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="mb-6">
          <CategoryBreadcrumb
            tenantSlug={tenantSlug}
            items={[{ label: category.name }]}
          />
        </div>

        <CategoryHeader category={category} />
        <CategoryProductGrid
          products={productResponse.products}
          tenantSlug={tenantSlug}
        />
      </main>
    </div>
  );
}

/**
 * SEO metadata for the category page.
 */
export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { tenantSlug, categoryId } = await params;

  try {
    const [category, tenant] = await Promise.all([
      getPublicCategory(tenantSlug, categoryId),
      getTenantInfo(tenantSlug),
    ]);

    if (!category) return { title: 'Category not found' };

    const title = category.name;
    const description =
      category.description ??
      `Browse ${category.name} products${tenant ? ` at ${tenant.name}` : ''}.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        locale: 'en_LK',
        ...(tenant ? { siteName: tenant.name } : {}),
        url: `${SITE.siteUrl}/${tenantSlug}/category/${categoryId}`,
      },
      alternates: {
        canonical: `/${tenantSlug}/category/${categoryId}`,
      },
    };
  } catch {
    return { title: 'Category' };
  }
}

export const revalidate = 60;
export const dynamicParams = true;
