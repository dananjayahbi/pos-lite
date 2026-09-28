import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicProduct, getPublicProducts, getBestSellingProducts } from '@/lib/api/products';
import { getTenantInfo } from '@/lib/api/website';
import { tenantHomePath } from '@/lib/tenant';
import { SITE } from '@/config/site';
import { ProductDetail } from '@/components/website/product-detail/ProductDetail';
import { ProductHealthSections } from '@/components/website/product-detail/ProductHealthSections';
import { RelatedProducts } from '@/components/website/product-detail/RelatedProducts';
import { Breadcrumb } from '@/components/website/product-detail/Breadcrumb';
import { StoreHeader } from '@/components/website/common/StoreHeader';
import type { PublicProduct } from '@/types/website.types';

interface ProductPageProps {
  params: Promise<{ tenantSlug: string; productId: string }>;
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { tenantSlug, productId } = await params;

  // Fetch product + tenant in parallel
  const [product, tenant] = await Promise.all([
    getPublicProduct(tenantSlug, productId),
    getTenantInfo(tenantSlug),
  ]);

  if (!product || !tenant) notFound();

  // Fetch related products from the same category (best-effort). If the
  // category has few items, top up from the store's best-sellers so the grid
  // stays full and doesn't look sparse.
  let related: PublicProduct[] = [];
  if (product.categoryId) {
    try {
      const res = await getPublicProducts(tenantSlug, {
        categoryId: product.categoryId,
        limit: 12,
      });
      related = res.products.filter((p) => p.id !== product.id).slice(0, 8);
    } catch {
      // Graceful — related section simply won't render
    }
  }

  if (related.length < 8) {
    try {
      const best = await getBestSellingProducts(tenantSlug, 12);
      related = [
        ...related,
        ...best.filter((p) => p.id !== product.id && !related.some((r) => r.id === p.id)),
      ].slice(0, 8);
    } catch {
      // Best-effort only
    }
  }

  return (
    <div className="min-h-screen bg-[#051610] text-[#cbd5e1]">
      {/* Common top bar with cart button */}
      <StoreHeader tenantSlug={tenantSlug} storeName={tenant.name} />

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Breadcrumb
            tenantSlug={tenantSlug}
            items={[
              { label: 'Products', href: tenantHomePath(tenantSlug) },
              { label: product.name },
            ]}
          />
        </div>

        {/* Product layout — gallery + info kept in sync (variant ↔ image) */}
        <ProductDetail product={product} tenantSlug={tenantSlug} tenantName={tenant.name} />

        {/* Structured Ayurvedic health/usage content */}
        <ProductHealthSections product={product} />
      </main>

      {/* Related products */}
      <RelatedProducts products={related} tenantSlug={tenantSlug} />
    </div>
  );
}

/**
 * SEO metadata for the product page.
 */
export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { tenantSlug, productId } = await params;

  try {
    const [product, tenant] = await Promise.all([
      getPublicProduct(tenantSlug, productId),
      getTenantInfo(tenantSlug),
    ]);

    if (!product) return { title: 'Product not found' };

    const image =
      product.mainImageUrl ??
      product.variants?.[0]?.imageUrls?.[0] ??
      product.primaryVariant?.imageUrls?.[0];
    const description =
      product.description ??
      `Buy ${product.name}${tenant ? ` at ${tenant.name}` : ''}.`;

    return {
      title: product.name,
      description,
      openGraph: {
        title: product.name,
        description,
        type: 'website',
        locale: 'en_LK',
        ...(tenant ? { siteName: tenant.name } : {}),
        ...(image ? { images: [{ url: image }] } : {}),
        url: `${SITE.siteUrl}/${tenantSlug}/product/${productId}`,
      },
      alternates: {
        canonical: `/${tenantSlug}/product/${productId}`,
      },
    };
  } catch {
    return { title: 'Product' };
  }
}

export const revalidate = 60;
export const dynamicParams = true;
