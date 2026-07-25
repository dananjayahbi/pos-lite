import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPublicProduct, getPublicProducts } from '@/lib/api/products';
import { getTenantInfo, getPublicWebsiteConfig } from '@/lib/api/website';
import { tenantHomePath } from '@/lib/tenant';
import { formatLKR } from '@/lib/utils';
import { SITE } from '@/config/site';
import { ProductGallery } from '@/components/website/product-detail/ProductGallery';
import { ProductInfo } from '@/components/website/product-detail/ProductInfo';
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
    <div className="min-h-screen bg-white">
      {/* Minimal top bar */}
      <header className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-3">
          <Link
            href={tenantHomePath(tenantSlug)}
            className="text-lg font-medium"
            style={{ fontFamily: 'var(--font-dm-serif), serif' }}
          >
            {tenant.name}
          </Link>
          <Link
            href={tenantHomePath(tenantSlug)}
            className="text-sm text-gray-500 hover:text-black transition-colors"
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

        {/* Product layout */}
        <div className="grid gap-8 md:grid-cols-2">
          <ProductGallery
            variants={product.variants}
            productName={product.name}
          />
          <ProductInfo
            product={product}
            tenantSlug={tenantSlug}
          />
        </div>
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

    const price =
      product.variants?.[0]?.retailPrice ??
      product.primaryVariant?.retailPrice;
    const image =
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
