import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPublicProduct, getPublicProducts } from '@/lib/api/products';
import { getTenantInfo } from '@/lib/api/website';
import { tenantHomePath } from '@/lib/tenant';
import { SITE } from '@/config/site';
import { ProductDetail } from '@/components/website/product-detail/ProductDetail';
import { ProductHealthSections } from '@/components/website/product-detail/ProductHealthSections';
import { RelatedProducts } from '@/components/website/product-detail/RelatedProducts';
import { Breadcrumb } from '@/components/website/product-detail/Breadcrumb';
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

  // Fetch related products from the same category (best-effort)
  let related: PublicProduct[] = [];
  if (product.categoryId) {
    try {
      const res = await getPublicProducts(tenantSlug, {
        categoryId: product.categoryId,
        limit: 5,
      });
      related = res.products.filter((p) => p.id !== product.id).slice(0, 4);
    } catch {
      // Graceful — related section simply won't render
    }
  }

  return (
    <div className="min-h-screen bg-[#051610] text-[#cbd5e1]">
      {/* Minimal top bar */}
      <header className="border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
          <Link
            href={tenantHomePath(tenantSlug)}
            className="text-lg font-medium text-white"
            style={{ fontFamily: 'var(--font-serif), serif' }}
          >
            {tenant.name}
          </Link>
          <Link
            href={tenantHomePath(tenantSlug)}
            className="text-sm text-[#94a3b8] hover:text-[#97c93e] transition-colors"
          >
            ← Back to store
          </Link>
        </div>
      </header>

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
        <ProductDetail product={product} tenantSlug={tenantSlug} />

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
