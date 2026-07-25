// filepath: src/components/website/Storefront.tsx
// Server component that owns the full data-fetching + rendering pipeline
// for the public storefront. It is used by BOTH the root route
// (`app/page.tsx`) and the explicit tenant route (`app/[tenantSlug]/page.tsx`)
// so the URL structure stays consistent and the data logic lives in one place.

import { notFound } from 'next/navigation';
import { WebsiteShell } from '@/components/website/WebsiteShell';
import { getPublicWebsiteConfig, getTenantInfo } from '@/lib/api/website';
import { getBestSellingProducts, getLatestProducts } from '@/lib/api/products';
import { getPublicCategories } from '@/lib/api/categories';
import { ApiError } from '@/lib/api/client';
import type { WebsiteConfigData } from '@/types/website.types';

interface StorefrontProps {
  /** Tenant slug to render the storefront for. */
  tenantSlug: string;
}

/**
 * Render the storefront for the given tenant slug.
 *
 * Performs:
 *   1. Tenant lookup (404 if missing)
 *   2. Parallel fetch of config + latest products + best-selling + categories
 *   3. Renders <WebsiteShell/> with the resolved data, falling back to a
 *      friendly error message if the ERP is unreachable.
 *
 * Errors from the ERP (network/5xx) degrade gracefully: missing data falls
 * back to placeholder fixtures inside each section component.
 */
export async function Storefront({ tenantSlug }: StorefrontProps) {
  // 1. Resolve tenant
  let tenant;
  try {
    tenant = await getTenantInfo(tenantSlug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    // Other errors (network, 5xx) — fall through to the friendly error UI.
    // eslint-disable-next-line no-console
    console.error('[storefront] tenant lookup failed', err);
    return (
      <StorefrontError
        tenantSlug={tenantSlug}
        message="Our storefront is temporarily unavailable. Please try again shortly."
      />
    );
  }

  if (!tenant) notFound();

  // 2. Fetch all content in parallel — each fetch is independent and
  //    isolated so a single failure does not block the others.
  const [configResponse, latest, bestSelling, categories] = await Promise.all([
    getPublicWebsiteConfig(tenantSlug).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[storefront] config fetch failed', err);
      return null;
    }),
    getLatestProducts(tenantSlug, 10).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[storefront] latest products fetch failed', err);
      return [] as Awaited<ReturnType<typeof getLatestProducts>>;
    }),
    getBestSellingProducts(tenantSlug, 10).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[storefront] best-selling products fetch failed', err);
      return [] as Awaited<ReturnType<typeof getBestSellingProducts>>;
    }),
    getPublicCategories(tenantSlug, { limit: 8 }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[storefront] categories fetch failed', err);
      return [] as Awaited<ReturnType<typeof getPublicCategories>>;
    }),
  ]);

  // 3. Serialize for the client (strip Date objects etc.)
  const config: WebsiteConfigData | null = configResponse?.config
    ? (JSON.parse(JSON.stringify(configResponse.config)) as WebsiteConfigData)
    : null;

  return (
    <WebsiteShell
      tenantName={tenant.name}
      tenantSlug={tenant.slug}
      config={config}
      latestProducts={latest}
      bestSellingProducts={bestSelling}
      categories={categories}
    />
  );
}

// ── Inline helper for graceful degradation ──────────────────────────────────

interface StorefrontErrorProps {
  tenantSlug: string;
  message: string;
}

function StorefrontError({ tenantSlug, message }: StorefrontErrorProps) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#ece2d6] px-4">
      <div className="max-w-md text-center">
        <h1
          className="text-3xl md:text-5xl mb-4"
          style={{ fontFamily: 'var(--font-dm-serif), serif' }}
        >
          {tenantSlug}
        </h1>
        <p className="text-base text-gray-700">{message}</p>
      </div>
    </main>
  );
}